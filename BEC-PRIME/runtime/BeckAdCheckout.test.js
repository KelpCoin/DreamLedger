'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {prepareCheckout,parseInput,releaseEnabled}=require('./BeckAdCheckout');
const now=new Date('2026-11-01T00:00:00Z');
const enabled={BECK_AD_CHECKOUT_ENABLED:'true',BECK_AD_OWNER_RELEASE_APPROVED:'true',
 BECK_AD_WEBHOOK_DELIVERY_READY:'true',STRIPE_SECRET_KEY:'sk_test_offline_only'};
const request={market:'NZ',size:'small',email:'buyer@example.invalid',
 title:'Verified Buyer',destination_url:'https://example.com/landing',
 request_key:'synthetic_once_per_checkout_123456'};
const stock={inventory_source:'verified_registered_supabase',market:'NZ',
 total_founding_units:100,remaining_founding_units:100,unavailable_positions:[]};
const holdId='11111111-1111-4111-8111-111111111111';
const reserveOk=async()=>({status:'HELD',reservation_id:holdId,expires_at:'2026-11-01T01:00:00Z'});
const bindOk=async ({reservation_id,session_id})=>({linked:true,reservation_id,checkout_session_id:session_id});
const checkoutOk=async()=>({ok:true,json:async()=>({id:'cs_test_offline_dummy',
 url:'https://checkout.stripe.com/c/pay/synthetic',livemode:false,payment_status:'unpaid'})});
async function run(opts={}){return prepareCheckout(request,{env:enabled,now,getInventory:async()=>stock,
 makeReservation:reserveOk,findExisting:async()=>null,bindReservation:bindOk,fetchImpl:checkoutOk,...opts});}
test('default flags reject before reading provider or inventory',async()=>{
 let calls=0;
 await assert.rejects(()=>run({env:{...enabled,BECK_AD_OWNER_RELEASE_APPROVED:'false'},
 getInventory:async()=>{calls++;return stock;}}),/checkout_disabled/);
 assert.equal(calls,0);
});
test('one missing gate stays closed',()=>{
 for(const flag of ['BECK_AD_CHECKOUT_ENABLED','BECK_AD_OWNER_RELEASE_APPROVED','BECK_AD_WEBHOOK_DELIVERY_READY'])
 assert.equal(releaseEnabled({...enabled,[flag]:undefined}),false);
});
test('rejects unapproved product sizes and malicious URL',()=>{
 assert.throws(()=>parseInput({...request,size:'takeover'}),/unavailable_product/);
 assert.throws(()=>parseInput({...request,destination_url:'http://example.com'}),/invalid_destination/);
 assert.throws(()=>parseInput({...request,destination_url:'https://127.0.0.1/'}),/invalid_destination/);
});
test('only valid strong idempotency keys accepted',()=>{
 assert.throws(()=>parseInput({...request,request_key:'weak'}),/invalid_idempotency/);
});
test('cannot create checkout without independently sourced stock',async()=>{
 let charged=0;
 await assert.rejects(()=>run({getInventory:async()=>({...stock,inventory_source:'static_demo'}),
 fetchImpl:async()=>{charged++;return checkoutOk();}}),/verified_inventory_unavailable/);
 assert.equal(charged,0);
});
test('cannot create checkout if registry count mismatches occupancy',async()=>{
 await assert.rejects(()=>run({getInventory:async()=>({...stock,remaining_founding_units:99})}),/inventory_count_conflict/);
});
test('reserve is required before Stripe and metadata has attribution',async()=>{
 let order=[],seenKey='';
 const r=await run({makeReservation:async(input)=>{
   order.push('reserve');
   assert.equal(input.placement.price_minor,5000);
   assert.equal(input.placement.end_utc,'3000-01-01T00:00:00Z');
   return reserveOk();
 },fetchImpl:async(url,options)=>{
   order.push('stripe');assert.match(url,/stripe.com\/v1\/checkout\/sessions/);
   const form=new URLSearchParams(options.body);
   for(const key of ['product_sku','product_id','offer_id','silo','source'])
     assert.ok(form.get('payment_intent_data[metadata]['+key+']'));
   assert.equal(form.get('line_items[0][price_data][unit_amount]'),'5000');
   assert.equal(form.get('metadata[reservation_id]'),holdId);
   assert.equal(form.get('metadata[review_status]'),'APPROVAL_REQUIRED');
   assert.equal(form.get('expires_at'),String(Math.floor(now.valueOf()/1000)+1800));
   seenKey=options.headers['idempotency-key'];
   return checkoutOk();
 }});
 assert.deepEqual(order,['reserve','stripe']);assert.match(seenKey,/^beck-ad-[a-f0-9]{64}$/);
 assert.equal(r.payment_verified,false);assert.equal(r.delivery_verified,false);
 assert.equal(r.publication,'APPROVAL_REQUIRED');
});
test('insufficient hold lifespan blocks Stripe',async()=>{
 let called=false;
 await assert.rejects(()=>run({makeReservation:async()=>({status:'HELD',reservation_id:'x',
 expires_at:'2026-11-01T00:31:00Z'}),fetchImpl:async()=>{called=true;return checkoutOk()}}),/reservation_unavailable/);
 assert.equal(called,false);
});
test('paid order cannot restart checkout with same reservation',async()=>{
 await assert.rejects(()=>run({makeReservation:async()=>({...await reserveOk(),status:'PAID'})}),/reservation_unavailable/);
});
test('provider transport failure never claims paid',async()=>{
 await assert.rejects(()=>run({fetchImpl:async()=>{throw Error('timeout')}}),/checkout_provider_unavailable/);
});
test('provider unexpected host is rejected',async()=>{
 await assert.rejects(()=>run({fetchImpl:async()=>({ok:true,json:async()=>({id:'cs_test_fake',
 url:'https://evil.invalid/checkout',livemode:false})})}),/checkout_provider_invalid/);
});
test('live Stripe key cannot accept testmode response',async()=>{
 await assert.rejects(()=>run({env:{...enabled,STRIPE_SECRET_KEY:'sk_live_offline_fake'},
 fetchImpl:checkoutOk}),/checkout_provider_invalid/);
});
test('conflicting tile retries only bounded times',async()=>{
 let n=0;
 const r=await run({makeReservation:async()=>{n++;if(n===1)throw Error('beck_ad_inventory_conflict');return reserveOk();}});
 assert.equal(n,2);assert.equal(r.reservation_id,holdId);
});

test('binding failure expires orphan Checkout Session before revealing URL',async()=>{
 let expireCalls=0;
 await assert.rejects(()=>run({
   bindReservation:async()=>{throw Error('database unavailable')},
   fetchImpl:async(url)=>{
     if(url.endsWith('/expire')){expireCalls++;return {ok:true};}
     return checkoutOk();
   }
 }),/checkout_binding_unverified/);
 assert.equal(expireCalls,1);
});
test('binding a different reservation is never treated as success',async()=>{
 await assert.rejects(()=>run({
   bindReservation:async({session_id})=>({linked:true,reservation_id:'WRONG',checkout_session_id:session_id})
 }),/checkout_binding_unverified/);
});

test('same customer replay reuses held tile even if inventory now marks full',async()=>{
 let inventoryCalls=0,reserveCalls=0,lookupCalls=0;
 const prev={reservation_id:holdId,status:'HELD',hold_expires_at:'2026-11-01T01:00:00Z',
  checkout_session_expires_at:'2026-11-01T00:30:00Z',
  price_minor:5000,currency:'NZD',width:100,height:100,
  canvas_width:1000,canvas_height:1000,x:0,y:0,
  campaign_start:'2026-11-01T00:00:00Z',campaign_end:'3000-01-01T00:00:00Z'};
 const result=await run({
   findExisting:async()=>{lookupCalls++;return prev},
   getInventory:async()=>{inventoryCalls++;return {...stock,remaining_founding_units:0}},
   makeReservation:async()=>{reserveCalls++;return reserveOk()}
 });
 assert.equal(result.reservation_id,holdId);
 assert.equal(lookupCalls,1);
 assert.equal(inventoryCalls,0);
 assert.equal(reserveCalls,0);
});
test('a paid or expired replay never creates another Stripe session',async()=>{
 for(const status of ['PAID','EXPIRED']){
   let charged=false;
   await assert.rejects(()=>run({
     findExisting:async()=>({reservation_id:holdId,status}),
     fetchImpl:async()=>{charged=true;return checkoutOk()}
   }),/reservation_replay_unavailable/);
   assert.equal(charged,false);
 }
});
