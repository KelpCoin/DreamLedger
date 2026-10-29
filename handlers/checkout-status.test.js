'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const status=require('./checkout-status.js');
const id='cs_test_'+ 'a'.repeat(24);
const request=(sid=id,method='GET')=>new Request('https://dreamledger.org/api/checkout-status?session_id='+encodeURIComponent(sid),{method});
const stripe=(fields={})=>({
  ok:true, async json(){return {object:'checkout.session',id,livemode:false,
    payment_status:'paid',status:'complete',metadata:{},...fields};}
});
async function body(resp){return resp.json();}
test('URL alone never proves a payment: fails closed without server configuration',async()=>{
  const r=await status(request(),{secret:''});
  assert.equal(r.status,503); assert.equal((await body(r)).paid,undefined);
});
test('malformed and missing session identifiers rejected before provider lookup',async()=>{
  for(const sid of ['','paid','cs_live_bad/?foo=1']){
    const r=await status(request(sid),{secret:'synthetic',fetcher:()=>{throw Error('should not run')}});
    assert.equal(r.status,400);
  }
});
test('provider-paid test checkout is clearly test mode, not settled or delivered',async()=>{
  let called=false;
  const r=await status(request(),{secret:'synthetic',fetcher:async(url,opts)=>{
    called=true;assert.equal(url,'https://api.stripe.com/v1/checkout/sessions/'+id);
    assert.equal(opts.method,'GET');return stripe({metadata:{sku:'COMMANDER-DECK-DIAGNOSTIC-001'}});
  }});
  assert.ok(called);
  const b=await body(r);assert.equal(r.status,200);
  assert.equal(b.verified,true);assert.equal(b.paid,true);assert.equal(b.test_mode,true);
  assert.equal(b.independent_settlement_verified,false);
  assert.equal(b.fulfilment_verified,false);assert.equal(b.next_step,'DIAGNOSTIC_INPUT');
  assert.ok(!JSON.stringify(b).includes('synthetic'));
});
test('unpaid and incomplete checkouts do not show payment received',async()=>{
  for(const fields of [{payment_status:'unpaid'}, {status:'open'}, {payment_status:'no_payment_required'}]){
    const r=await status(request(),{secret:'synthetic',fetcher:async()=>stripe(fields)});
    assert.equal((await body(r)).paid,false);
  }
});
test('a different checkout session ID is not accepted as proof',async()=>{
  const r=await status(request(),{secret:'synthetic',fetcher:async()=>stripe({id:'cs_test_wrong_other_session'})});
  assert.equal(r.status,503);
});
test('provider failures, invalid responses and network errors fail closed',async()=>{
  for(const fetcher of [
    async()=>({ok:false,status:401}),
    async()=>({ok:true,json:async()=>({})}),
    async()=>{throw Error('offline');}
  ]){
    const r=await status(request(),{secret:'synthetic',fetcher});
    assert.equal(r.status,503);
  }
});
test('only a verified live session can be shown as a real reported payment',async()=>{
  const r=await status(request(),{secret:'synthetic',fetcher:async()=>stripe({livemode:true})});
  const b=await body(r);assert.equal(b.paid,true);assert.equal(b.test_mode,false);
  assert.equal(b.independent_settlement_verified,false);
});
test('public success page starts unverified and performs server verification',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../public/success.html'),'utf8');
 assert.match(html,/Verifying checkout/);
 assert.match(html,/\/api\/checkout-status\?session_id=/);
 assert.doesNotMatch(html,/<div class="ok">Payment received<\/div>/);
});
