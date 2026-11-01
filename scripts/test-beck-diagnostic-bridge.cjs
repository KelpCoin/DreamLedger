'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('handlers/commercial-diagnostic-input.ts','utf8');
const ts=stripTypeScriptTypes(source,{mode:'strip'}).replace(
 'export default async function handler','globalThis.__handler = async function handler');
const session='cs_test_SYNTHETIC12345678901';
function setup(serverResponse={status:200,body:{ok:true,status:'queued',fulfillment_id:'f-synthetic'}}){
 const calls=[];
 const fetch=async(url,options)=>{
  calls.push({url:String(url),method:options.method,headers:options.headers,
   body:options.body});
  return new Response(JSON.stringify(serverResponse.body),{status:serverResponse.status,
    headers:{'content-type':'application/json'}});
 };
 const context={Response,Request,URL,TextEncoder,AbortSignal,fetch,console,globalThis:null};
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
 const result=await t.invoke({session_id:session,decklist:'1 Sol Ring\n1 Command Tower\n1 Arcane Signet',email:'untrusted@example.test'});
 assert.equal(result.status,202);
 assert.deepEqual(await result.json(),{ok:true,status:'queued',fulfillment_id:'f-synthetic',
  report_delivered:false,payment_verified_by:'existing_supabase_intake'});
 assert.equal(t.calls.length,1);
 assert.equal(t.calls[0].url,'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input');
 assert.equal(t.calls[0].method,'POST');
 assert.deepEqual(JSON.parse(t.calls[0].body),{session_id:session,decklist:'1 Sol Ring\n1 Command Tower\n1 Arcane Signet'});
});
test('untrusted origin cannot send checkout reference to intake',async()=>{
 const t=setup();const r=await t.invoke({session_id:session,decklist:'1 Sol Ring 1 Command Tower'},'https://evil.example');
 assert.equal(r.status,403);assert.equal(t.calls.length,0);
});
test('invalid or missing Stripe reference is denied before upstream access',async()=>{
 const t=setup();
 for(const sid of ['x','cs_live_abc','cs_bad_abcdefghijklmnopqrstuvwxyz','']){
  const r=await t.invoke({session_id:sid,decklist:'1 Sol Ring 1 Command Tower'});
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
 const r=await t.invoke({session_id:session,decklist:'1 Sol Ring 1 Command Tower'});
 assert.equal(r.status,409);assert.equal((await r.json()).retryable,true);
});
test('upstream error cannot fabricate a fulfilled report',async()=>{
 const t=setup({status:500,body:{error:'private database error'}});
 const r=await t.invoke({session_id:session,decklist:'1 Sol Ring 1 Command Tower'});
 assert.equal(r.status,503);assert.equal((await r.text()).includes('private database error'),false);
});
test('upstream malformed success does not claim intake',async()=>{
 const t=setup({status:200,body:{ok:true,fulfillment_id:'f-synthetic',status:'fulfilled'}});
 const r=await t.invoke({session_id:session,decklist:'1 Sol Ring 1 Command Tower'});
 assert.equal(r.status,503);
});
test('no fake paid status on GET or missing origin',async()=>{
 const t=setup();
 const r=await t.invoke({session_id:session,decklist:'1 Sol Ring 1 Command Tower'},'https://dreamledger.org','GET');
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
