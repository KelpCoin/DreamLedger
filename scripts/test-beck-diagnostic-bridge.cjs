'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('handlers/commercial-diagnostic-input.ts','utf8');
const ts=stripTypeScriptTypes(source,{mode:'strip'}).replace(
 'export default async function handler','globalThis.__handler = async function handler');
const session='cs_live_SYNTHETIC12345678901';
const testSession='cs_test_SYNTHETIC12345678901';
const fullDeck=Array.from({length:100},(_,i)=>'1 Synthetic Card '+(i+1)).join('\n');
function setup(serverResponse={status:200,body:{ok:true,status:'queued',fulfillment_id:'f-synthetic'}},
  verifier={status:200,body:{state:'paid_recorded',retryable:false}},env={}){
 const calls=[];
 const fetch=async(url,options)=>{
  calls.push({url:String(url),method:options.method,headers:options.headers,
   body:options.body});
  const target=String(url).includes('/mtg-commander-status?')?verifier:serverResponse;
  return new Response(typeof target.body==='string'?target.body:JSON.stringify(target.body),{status:target.status,
    headers:{'content-type':'application/json'}});
 };
 const context={Response,Request,URL,TextEncoder,AbortSignal,fetch,console,process:{env},globalThis:null};
 context.globalThis=context;
 vm.runInNewContext(ts,context,{filename:'commercial-diagnostic-input.ts'});
 const invoke=(body,origin='https://dreamledger.org',method='POST')=>context.__handler(
   new Request('https://dreamledger.org/api/commercial/input',{
     method,headers:{origin,'content-type':'application/json'},
     body:method==='POST'?JSON.stringify(body):undefined
   })
 );
 return{invoke,calls};
}
test('paid checkout reference forwards once into existing Supabase delivery queue',async()=>{
 const t=setup();
 const result=await t.invoke({session_id:session,decklist:fullDeck,email:'untrusted@example.test'});
 assert.equal(result.status,202);
 assert.deepEqual(await result.json(),{ok:true,status:'queued',fulfillment_id:'f-synthetic',
  report_delivered:false,payment_verified_by:'existing_supabase_intake'});
 assert.equal(t.calls.length,2);
 assert.equal(t.calls[0].url,'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/mtg-commander-status?session_id='+session);
 assert.equal(t.calls[0].method,'GET');
 assert.equal(t.calls[0].headers.origin,'https://dreamledger.org');
 assert.equal(t.calls[1].url,'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input');
 assert.equal(t.calls[1].method,'POST');
 assert.deepEqual(JSON.parse(t.calls[1].body),{session_id:session,decklist:fullDeck});
});
test('payment verifier denies unpaid, pending, mismatch and unknown without intake write',async()=>{
 for(const state of ['awaiting_payment','paid_pending_record','product_mismatch','invalid_session','unknown']){
  const t=setup(undefined,{status:200,body:{state,retryable:state==='paid_pending_record'}});
  const r=await t.invoke({session_id:session,decklist:fullDeck});
  assert([409,503].includes(r.status),state);
  assert.equal(t.calls.length,1,state);
  assert(t.calls[0].url.includes('/mtg-commander-status?'),state);
 }
});
test('verifier errors, malformed JSON, and non-final verdict fail closed',async()=>{
 for(const v of [
  {status:503,body:{state:'verification_unavailable'}},
  {status:200,body:'not-json'},
  {status:200,body:{state:'paid_recorded',retryable:true}},
  {status:200,body:{state:'paid_recorded'}},
  {status:200,body:'x'.repeat(2100)}
 ]){
  const t=setup(undefined,v);
  const r=await t.invoke({session_id:session,decklist:fullDeck});
  assert.equal(r.status,503);
  assert.equal(t.calls.length,1);
 }
});
test('untrusted origin cannot send checkout reference to intake',async()=>{
 const t=setup();const r=await t.invoke({session_id:session,decklist:fullDeck},'https://evil.example');
 assert.equal(r.status,403);assert.equal(t.calls.length,0);
});
test('invalid or missing Stripe reference is denied before upstream access',async()=>{
 const t=setup();
 for(const sid of ['x','cs_live_abc','cs_bad_abcdefghijklmnopqrstuvwxyz','']){
  const r=await t.invoke({session_id:sid,decklist:fullDeck});
  assert.equal(r.status,422);
 }
 assert.equal(t.calls.length,0);
});
test('short decklist is denied before upstream access',async()=>{
 const t=setup();const r=await t.invoke({session_id:session,decklist:'1 Sol'});
 assert.equal(r.status,422);assert.equal(t.calls.length,0);
});
test('upstream still processing payment cannot claim accepted',async()=>{
 const t=setup({status:409,body:{error:'webhook pending'}});
 const r=await t.invoke({session_id:session,decklist:fullDeck});
 assert.equal(r.status,409);assert.equal((await r.json()).retryable,true);
});
test('upstream error cannot fabricate a fulfilled report',async()=>{
 const t=setup({status:500,body:{error:'private database error'}});
 const r=await t.invoke({session_id:session,decklist:fullDeck});
 assert.equal(r.status,503);assert.equal((await r.text()).includes('private database error'),false);
});
test('upstream malformed success does not claim intake',async()=>{
 const t=setup({status:200,body:{ok:true,fulfillment_id:'f-synthetic',status:'fulfilled'}});
 const r=await t.invoke({session_id:session,decklist:fullDeck});
 assert.equal(r.status,503);
});
test('no fake paid status on GET or missing origin',async()=>{
 const t=setup();
 const r=await t.invoke({session_id:session,decklist:fullDeck},'https://dreamledger.org','GET');
 assert.equal(r.status,405);assert.equal(t.calls.length,0);
});
test('public return route and Vercel dispatcher complete the intake navigation',()=>{
 const router=fs.readFileSync('api/[...route].ts','utf8');
 const page=fs.readFileSync('public/diagnostic-input.html','utf8');
 const returnJs=fs.readFileSync('public/assets/checkout-return.js','utf8');
 assert(router.includes('"/api/commercial/input"')&&router.includes('../handlers/commercial-diagnostic-input.ts'));
 assert(page.includes("fetch('/api/commercial/input'"));
 assert(returnJs.includes("next.href='/diagnostic-input.html?session_id='"));
 assert(!page.includes('id="email"'));
});

test('complete decklist required before payment verification or durable intake',async()=>{
 const variants=[
  {deck:fullDeck.split('\n').slice(0,99).join('\n'),error:'DECKLIST_CARD_COUNT'},
  {deck:fullDeck+'\n1 Extra Card',error:'DECKLIST_CARD_COUNT'},
  {deck:'0 Invalid Card\n'+fullDeck,error:'DECKLIST_INVALID_CARD'},
  {deck:fullDeck+'\nSideboard: 1 Illegal Card',error:'DECKLIST_UNSUPPORTED_SECTION'},
  {deck:'9999 Invalid Quantity\n'+fullDeck,error:'DECKLIST_INVALID_CARD'},
  {deck:'100 Test Card\n1 Extra Card',error:'DECKLIST_CARD_COUNT'}
 ];
 for(const {deck,error} of variants){
  const t=setup();
  const response=await t.invoke({session_id:session,decklist:deck});
  assert.equal(response.status,422,error);
  const result=await response.json();
  assert.equal(result.error,error);
  assert.equal(result.expected_cards,100);
  assert.equal(t.calls.length,0,'must reject before any network call');
 }
});
test('100-card quantity notation and section headers pass structural preflight',async()=>{
 const t=setup();
 const deck='Commander:\n1 Synthetic Commander\nMainboard:\n99 Synthetic Cards';
 const response=await t.invoke({session_id:session,decklist:deck});
 assert.equal(response.status,202);
 assert.equal(t.calls.length,2);
});

test('TEST checkout cannot send decklist to LIVE intake without isolated project configuration',async()=>{
 const t=setup();
 const r=await t.invoke({session_id:testSession,decklist:fullDeck});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'TEST_DIAGNOSTIC_INPUT_UNAVAILABLE');
 assert.equal(t.calls.length,0,'no provider read or write before test isolation');
});
test('configured TEST checkout routes only to exact isolated existing Supabase intake',async()=>{
 const ref='abcdefghijklmnopqrst';
 const url='https://'+ref+'.supabase.co/functions/v1/marketplace-diagnostic-input';
 const t=setup(undefined,undefined,{
  BECK_STRIPE_TEST_PROJECT_REF:ref,MTG_DIAGNOSTIC_TEST_INPUT_URL:url
 });
 const r=await t.invoke({session_id:testSession,decklist:fullDeck});
 assert.equal(r.status,202);
 assert.equal(t.calls.length,2);
 assert.equal(t.calls[0].method,'GET');
 assert(t.calls[0].url.endsWith('session_id='+testSession));
 assert.equal(t.calls[1].method,'POST');
 assert.equal(t.calls[1].url,url);
 assert.notEqual(t.calls[1].url,'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input');
 assert.equal((await r.json()).report_delivered,false);
});
test('TEST checkout rejects production project, wrong endpoint and missing project',async()=>{
 const ref='abcdefghijklmnopqrst';
 const variants=[
  {BECK_STRIPE_TEST_PROJECT_REF:'wbwgroygjeyukkspnqiy',
   MTG_DIAGNOSTIC_TEST_INPUT_URL:'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input'},
  {BECK_STRIPE_TEST_PROJECT_REF:ref,
   MTG_DIAGNOSTIC_TEST_INPUT_URL:'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input'},
  {BECK_STRIPE_TEST_PROJECT_REF:ref,
   MTG_DIAGNOSTIC_TEST_INPUT_URL:'https://'+ref+'.supabase.co/functions/v1/unrelated'},
  {BECK_STRIPE_TEST_PROJECT_REF:ref},
  {MTG_DIAGNOSTIC_TEST_INPUT_URL:'https://'+ref+'.supabase.co/functions/v1/marketplace-diagnostic-input'}
 ];
 for(const env of variants){
  const t=setup(undefined,undefined,env);
  const r=await t.invoke({session_id:testSession,decklist:fullDeck});
  assert.equal(r.status,503,JSON.stringify(env));
  assert.equal(t.calls.length,0,'must not access any provider for invalid isolation');
 }
});
