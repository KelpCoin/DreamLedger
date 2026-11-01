'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {reconcileExpiredCheckout}=require('./BeckAdCheckoutRelease');
const now=new Date('2026-11-01T12:00:00Z');
const env={BECK_AD_EXPIRY_RECONCILIATION_ENABLED:'true',
 STRIPE_SECRET_KEY:'sk_test_offline',SUPABASE_URL:'https://fake.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'offline-testing-not-a-real-service-role-secret'};
const reservation={status:'HELD',reservation_id:'11111111-1111-4111-8111-111111111111',
 checkout_session_id:'cs_test_synthetic_unpaid',checkout_session_expires_at:'2026-11-01T11:00:00Z',
 creative_manifest_sha256:'a'.repeat(64)};
const session={id:reservation.checkout_session_id,status:'expired',payment_status:'unpaid',
 livemode:false,metadata:{reservation_id:reservation.reservation_id,
 product_sku:'BECK-AD-FOUNDING-100X100',
 source:'beck_ad_reserved_checkout',
 creative_sha256:reservation.creative_manifest_sha256}};
function provider(calls,modified={}){
 return async(url,opts)=>{
   calls.push(url);
   if(url.includes('api.stripe.com'))return {ok:true,json:async()=>({...session,...modified})};
   if(url.includes('rpc/beck_ad_release_expired_checkout')){
     const payload=JSON.parse(opts.body);
     assert.equal(payload.p_reservation_id,reservation.reservation_id);
     assert.equal(payload.p_checkout_session_id,reservation.checkout_session_id);
     assert.match(payload.p_sha256,/^[a-f0-9]{64}$/);
     return {ok:true,json:async()=>({reservation_id:reservation.reservation_id,
       checkout_session_id:reservation.checkout_session_id,
       reconciliation_sha256:payload.p_sha256,provider_status:'expired',
       provider_payment_status:'unpaid'})};
   }
   throw Error('unexpected url');
 };
}
test('disabled reconciliation does not query Stripe',async()=>{
 let n=0;
 await assert.rejects(()=>reconcileExpiredCheckout(reservation,{env:{...env,BECK_AD_EXPIRY_RECONCILIATION_ENABLED:'false'},
 now,fetchImpl:async()=>{n++}}),/disabled/);
 assert.equal(n,0);
});
test('still-active checkout is never released',async()=>{
 await assert.rejects(()=>reconcileExpiredCheckout({...reservation,checkout_session_expires_at:'2026-11-01T13:00:00Z'},
 {env,now,fetchImpl:async()=>{throw Error('called')}}),/not_eligible/);
});
test('unbound or missing creative cannot be released',async()=>{
 await assert.rejects(()=>reconcileExpiredCheckout({...reservation,creative_manifest_sha256:undefined},
 {env,now,fetchImpl:async()=>{throw Error('called')}}),/not_eligible/);
});
test('paid Stripe session cannot release inventory',async()=>{
 let calls=[];
 await assert.rejects(()=>reconcileExpiredCheckout(reservation,{env,now,fetchImpl:provider(calls,{payment_status:'paid',status:'complete'})}),/provider_mismatch/);
 assert.equal(calls.length,1);
});
test('different session or bad provider metadata cannot release inventory',async()=>{
 let calls=[];
 await assert.rejects(()=>reconcileExpiredCheckout(reservation,{env,now,fetchImpl:provider(calls,{id:'cs_test_wrong'})}),/provider_mismatch/);
 assert.equal(calls.length,1);
});
test('release requires live/test mode parity',async()=>{
 let calls=[];
 await assert.rejects(()=>reconcileExpiredCheckout(reservation,{env,now,fetchImpl:provider(calls,{livemode:true})}),/provider_mismatch/);
 assert.equal(calls.length,1);
});
test('verified expired and unpaid Stripe event can release and produce sha256',async()=>{
 const calls=[];
 const result=await reconcileExpiredCheckout(reservation,{env,now,fetchImpl:provider(calls)});
 assert.equal(calls.length,2);
 assert.match(calls[0],/stripe\.com/);
 assert.match(calls[1],/beck_ad_release_expired_checkout/);
 assert.equal(result.released_after_provider_verification,true);
 assert.equal(result.paid,false);
 assert.equal(result.delivery_verified,false);
 assert.match(result.provider_evidence_sha256,/^[a-f0-9]{64}$/);
});
test('database disagreement never reports released',async()=>{
 const calls=[];
 const f=async(url,opts)=>{
   const response=await provider(calls)(url,opts);
   if(url.includes('rpc/'))return {ok:false,status:400};
   return response;
 };
 await assert.rejects(()=>reconcileExpiredCheckout(reservation,{env,now,fetchImpl:f}),/store_rejected/);
});
test('network loss never reports released',async()=>{
 await assert.rejects(()=>reconcileExpiredCheckout(reservation,{env,now,
 fetchImpl:async()=>{throw Error('network')}}),/provider_unavailable/);
});
