'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {processStripeEvent,signatureVerified}=require('./BeckAdPaymentWebhook');
const now=new Date('2026-11-01T00:00:00Z');
const secret='offline-nonproduction-webhook-secret';
const env={BECK_AD_WEBHOOK_ENABLED:'true',BECK_AD_OWNER_RELEASE_APPROVED:'true',
 STRIPE_WEBHOOK_SECRET:secret,STRIPE_SECRET_KEY:'sk_live_dummy_not_real',
 BECK_AD_STRIPE_ACCOUNT_ID:'acct_1SNVPvEGgEAnUFF9',
 SUPABASE_URL:'https://example.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'offline-test-service-key-no-access'};
const sku='BECK-AD-FOUNDING-100X100';
const reservation='11111111-1111-4111-8111-111111111111';
const session={id:'cs_live_offline_only',livemode:true,payment_status:'paid',
 amount_total:5000,currency:'nzd',payment_intent:'pi_offline_only',
 metadata:{product_sku:sku,product_id:sku,offer_id:sku,silo:'ads',
 source:'beck_ad_reserved_checkout',reservation_id:reservation}};
const event={id:'evt_offline_only',type:'checkout.session.completed',livemode:true,
 data:{object:session}};
const receipt={event_id:'evt_offline_only',reservation_id:reservation,
 checkout_session_id:session.id,amount_minor:5000,currency:'NZD',
 status:'PAID_PENDING_CREATIVE_REVIEW'};
function pack(e=event){
 const raw=Buffer.from(JSON.stringify(e));
 const ts=Math.floor(now.valueOf()/1000);
 const sig=crypto.createHmac('sha256',secret).update(String(ts)+'.').update(raw).digest('hex');
 return {raw,header:'t='+ts+',v1='+sig};
}
function net(calls,options={}){
 return async(url,init)=>{
  calls.push({url,init});
  if(url.includes('api.stripe.com/'))
    return {ok:true,json:async()=>options.verifiedSession||session};
  if(url.includes('supabase.co/rest/v1/rpc/beck_ad_record_paid'))
    return {ok:options.failDb!==true,json:async()=>options.receipt||receipt};
  throw Error('unexpected URL');
 };
}
test('fails closed with webhook release missing',async()=>{
 const p=pack();await assert.rejects(()=>processStripeEvent(p.raw,p.header,
 {env:{...env,BECK_AD_WEBHOOK_ENABLED:'false'},now,fetchImpl:async()=>{throw Error('should not call')}}),/webhook_disabled/);
});
test('accepts valid HMAC and rejects stale/modified signatures',()=>{
 const p=pack();assert.equal(signatureVerified(p.raw,p.header,secret,now.valueOf()),true);
 assert.equal(signatureVerified(Buffer.from('changed'),p.header,secret,now.valueOf()),false);
 assert.equal(signatureVerified(p.raw,p.header,secret,now.valueOf()+301000),false);
});
test('unrelated signed webhook is ignored without provider calls',async()=>{
 const p=pack({...event,data:{object:{id:'unrelated'}}});let n=0;
 const result=await processStripeEvent(p.raw,p.header,{env,now,fetchImpl:async()=>{n++}});
 assert.equal(result.ignored,'not_beck_ad_checkout');assert.equal(n,0);
});
test('testmode event is ignored without a paid claim',async()=>{
 const p=pack({...event,livemode:false});const result=await processStripeEvent(p.raw,p.header,{env,now,fetchImpl:async()=>{throw Error('called')}});
 assert.equal(result.ignored,'not_live_paid_checkout');
});
test('wrong Stripe account fails closed',async()=>{
 const p=pack({...event,account:'acct_wrong'});
 await assert.rejects(()=>processStripeEvent(p.raw,p.header,{env,now,fetchImpl:async()=>{throw Error('called')}}),/wrong_stripe_account/);
});
test('wrong signed amount cannot write paid receipt',async()=>{
 const p=pack({...event,data:{object:{...session,amount_total:4999}}});let n=0;
 await assert.rejects(()=>processStripeEvent(p.raw,p.header,{env,now,fetchImpl:async()=>{n++}}),/payment_evidence_invalid/);
 assert.equal(n,0);
});
test('only independently read Stripe session can establish paid evidence',async()=>{
 const p=pack();const calls=[];
 await assert.rejects(()=>processStripeEvent(p.raw,p.header,{env,now,
 fetchImpl:net(calls,{verifiedSession:{...session,payment_status:'unpaid'}})}),/stripe_independent_mismatch/);
 assert.equal(calls.length,1);
});
test('writes paid receipt only after verified provider read',async()=>{
 const p=pack(),calls=[];
 const result=await processStripeEvent(p.raw,p.header,{env,now,fetchImpl:net(calls)});
 assert.equal(calls.length,2);assert.match(calls[0].url,/stripe.com/);
 assert.match(calls[1].url,/rpc\/beck_ad_record_paid$/);
 const body=JSON.parse(calls[1].init.body);
 assert.equal(body.p_reservation_id,reservation);
 assert.equal(body.p_amount_minor,5000);
 assert.equal(body.p_livemode,true);
 assert.equal(result.payment_recorded,true);
 assert.equal(result.publication,'NOT_AUTHORIZED');
 assert.equal(result.delivery_verified,false);
 assert.equal(result.independent_revenue_verified,false);
});
test('database unavailable must return retriable failure, not success',async()=>{
 const p=pack();await assert.rejects(()=>processStripeEvent(p.raw,p.header,{env,now,
 fetchImpl:net([],{failDb:true})}),/payment_receipt_store_rejected/);
});
test('wrong returned receipt cannot be accepted',async()=>{
 const p=pack();await assert.rejects(()=>processStripeEvent(p.raw,p.header,{env,now,
 fetchImpl:net([],{receipt:{...receipt,status:'PUBLISHED'}})}),/payment_receipt_invalid/);
});
test('bad HMAC never fetches provider or database',async()=>{
 const p=pack();let n=0;
 await assert.rejects(()=>processStripeEvent(p.raw,'t=1,v1=deadbeef',{env,now,fetchImpl:async()=>{n++}}),/invalid_stripe_signature/);
 assert.equal(n,0);
});
