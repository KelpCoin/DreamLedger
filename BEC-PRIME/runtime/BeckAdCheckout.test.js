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
const reserveOk=async()=>({status:'HELD',reservation_id:'test-hold-123',expires_at:'2026-11-01T01:00:00Z'});
const checkoutOk=async()=>({ok:true,json:async()=>({id:'cs_test_offline_dummy',
 url:'https://checkout.stripe.com/c/pay/synthetic',livemode:false,payment_status:'unpaid'})});
async function run(opts={}){return prepareCheckout(request,{env:enabled,now,getInventory:async()=>stock,
 makeReservation:reserveOk,fetchImpl:checkoutOk,...opts});}
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
   assert.equal(form.get('metadata[reservation_id]'),'test-hold-123');
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
 assert.equal(n,2);assert.equal(r.reservation_id,'test-hold-123');
});
