'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const source=fs.readFileSync('supabase/functions/mtg-commander-status/index.ts','utf8');
const SKU='COMMANDER-DECK-DIAGNOSTIC-001';
const id='cs_live_SYNTHETIC1234567890';
const listing='synthetic-listing';
const endpoint='https://example.supabase.co/functions/v1/mtg-commander-status?session_id='+id;
const sample=()=>({id,livemode:true,mode:'payment',status:'complete',payment_status:'paid',currency:'nzd',amount_subtotal:2900,
 metadata:{sku_id:SKU,marketplace_listing_id:listing},
 line_items:{has_more:false,data:[{quantity:1,price:{id:'price_1UFFY1EGgEAnUFF9Yq03zIa7',lookup_key:SKU,unit_amount:2900,currency:'nzd',metadata:{dreamledger_sku:SKU},product:{id:'prod_V6iVKl9HgFpzRU',metadata:{dreamledger_sku:SKU}}}}]}});
function setup(session=sample(),orders=[],fulfillments=[],env={}){
 let handler,calls=[];
 const vars={STRIPE_API_KEY:'synthetic-key',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-role',...env};
 const fetch=async(url,options={})=>{
  calls.push({url:String(url),method:options.method||'GET'});
  let payload=session;
  if(String(url).includes('marketplace_orders?'))payload=orders;
  if(String(url).includes('marketplace_fulfillments?'))payload=fulfillments;
  return new Response(JSON.stringify(payload),{status:200});
 };
 vm.runInNewContext(source,{Deno:{env:{get:(k)=>vars[k]},serve:(fn)=>{handler=fn}},fetch,URL,URLSearchParams,Response,Request,AbortSignal,console},{filename:'mtg-commander-status/index.ts'});
 const call=async(uri=endpoint,origin='https://dreamledger.org')=>{const r=await handler(new Request(uri,{headers:{Origin:origin}}));return{status:r.status,body:await r.json()};};
 return{call,calls};
}
test('untrusted origin rejected',async()=>{const a=setup();assert.equal((await a.call(endpoint,'https://other.example')).status,403);assert.equal(a.calls.length,0)});
test('invalid session id cannot assert payment',async()=>{const a=setup();assert.equal((await a.call('https://example.supabase.co/functions/v1/mtg-commander-status?session_id=oops')).body.state,'invalid_session');assert.equal(a.calls.length,0)});
test('missing Stripe key fails closed',async()=>{const a=setup(sample(),[],[],{STRIPE_API_KEY:undefined});assert.equal((await a.call()).status,503)});
test('unpaid session never grants access',async()=>{const s=sample();s.payment_status='unpaid';const a=setup(s);assert.equal((await a.call()).body.state,'awaiting_payment')});
test('wrong session SKU stops',async()=>{const s=sample();s.metadata.sku_id='CMD-DIAG-29';const a=setup(s);assert.equal((await a.call()).body.state,'product_mismatch')});
test('wrong product metadata stops',async()=>{const s=sample();s.line_items.data[0].price.product.metadata.dreamledger_sku='WRONG';const a=setup(s);assert.equal((await a.call()).body.state,'product_mismatch')});
test('paid Stripe without order stays pending',async()=>{const a=setup();assert.equal((await a.call()).body.state,'paid_pending_record')});
test('matching webhook-backed order and fulfillment permits read-only next step',async()=>{
 const a=setup(sample(),[{id:'ord-1',payment_status:'paid',listing_id:listing}],[{fulfillment_id:'ful-1',status:'queued'}]);
 assert.equal((await a.call()).body.state,'paid_recorded');assert.equal((await a.call()).body.state,'paid_recorded');
 assert.equal(a.calls.length,6);assert(a.calls.every(x=>x.method==='GET'));
});
test('failed fulfillment stays pending',async()=>{const a=setup(sample(),[{id:'ord-1',payment_status:'paid',listing_id:listing}],[{fulfillment_id:'ful-1',status:'failed'}]);assert.equal((await a.call()).body.state,'paid_pending_record')});
const testSession=()=>{
 const s=sample();s.id='cs_test_SYNTHETIC1234567890';s.livemode=false;
 s.line_items.data[0].price.id='price_TESTSYNTHETIC';return s;
};
const testUrl='https://example.supabase.co/functions/v1/mtg-commander-status?session_id=cs_test_SYNTHETIC1234567890';
const testVars={STRIPE_TEST_SECRET_KEY:'sk_test_SYNTHETIC',MTG_DIAGNOSTIC_TEST_PRICE_ID:'price_TESTSYNTHETIC'};
const testDb={...testVars,BECK_STRIPE_TEST_PROJECT_REF:'abcdefghijklmnopqrst',
 MTG_DIAGNOSTIC_TEST_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 MTG_DIAGNOSTIC_TEST_SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-role'};
test('test-mode paid session never reads production ledger without isolated test DB',async()=>{
 const a=setup(testSession(),[{id:'ord-1',payment_status:'paid',listing_id:listing}],[{fulfillment_id:'ful-1',status:'queued'}],testVars);
 assert.equal((await a.call(testUrl)).body.state,'paid_pending_record');
 assert.equal(a.calls.length,1);
 assert(a.calls[0].url.includes('api.stripe.com'));
});
test('isolated test-mode ledger can verify paid test order without production reads',async()=>{
 const a=setup(testSession(),[{id:'ord-1',payment_status:'paid',listing_id:listing}],[{fulfillment_id:'ful-1',status:'queued'}],testDb);
 assert.equal((await a.call(testUrl)).body.state,'paid_recorded');
 assert.equal(a.calls.length,3);
 assert(a.calls.slice(1).every(c=>c.url.startsWith('https://abcdefghijklmnopqrst.supabase.co/rest/v1/')));
 assert(a.calls.every(c=>c.method==='GET'));
});
test('test-mode DB cannot alias production project or reuse production role',async()=>{
 const a=setup(testSession(),[],[],{...testDb,MTG_DIAGNOSTIC_TEST_SUPABASE_URL:'https://example.supabase.co'});
 assert.equal((await a.call(testUrl)).body.state,'paid_pending_record');
 assert.equal(a.calls.length,1);
 const b=setup(testSession(),[],[],{...testDb,MTG_DIAGNOSTIC_TEST_SUPABASE_SERVICE_ROLE_KEY:'synthetic-role'});
 assert.equal((await b.call(testUrl)).body.state,'paid_pending_record');
 assert.equal(b.calls.length,1);
});
test('test-mode Stripe lookup rejects a live-mode key before network access',async()=>{
 const a=setup(testSession(),[],[],{...testDb,STRIPE_TEST_SECRET_KEY:'sk_live_SYNTHETIC'});
 assert.equal((await a.call(testUrl)).body.state,'verification_unavailable');
 assert.equal(a.calls.length,0);
});
console.log('BECK_SUPABASE_CHECKOUT_HERMETIC_PASS: 13 scenarios, no network, no charges');
