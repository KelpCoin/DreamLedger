'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeOrder,advance}=require('./order-lifecycle');
const hash='a'.repeat(64);
function source(type){
 return {STOCK_HELD:'trusted_stock',CHECKOUT_OPENED:'trusted_checkout',
 PAYMENT_REPORTED:'signed_provider',SETTLEMENT_VERIFIED:'independent_reconciler',
 FULFILLMENT_STARTED:'trusted_fulfillment',DELIVERY_PROVED:'trusted_delivery',
 CUSTOMER_ACCEPTED:'authenticated_buyer',REFUND_REQUESTED:'authenticated_buyer',
 REFUND_SETTLED:'independent_reconciler'}[type];
}
function start(silo='baby-kids'){
 return makeOrder({silo_id:silo,order_id:'order-test-001',item_id:'SKU-ITEM',
  currency:'NZD',amount_minor:1200,fulfillment_mode:'shipping'});
}
function step(order,type,n){
 return advance(order,{type,authenticated_source:source(type),silo_id:order.silo_id,
  order_id:order.order_id,currency:'NZD',amount_minor:1200,
  event_id:'synthetic-event-'+n,evidence_sha256:hash});
}
test('unrelated domains share exactly the same checkout to customer-acceptance pipeline',()=>{
 for(const silo of ['mtg','baby-kids','books-stationery']){
  let o=start(silo);
  const types=['STOCK_HELD','CHECKOUT_OPENED','PAYMENT_REPORTED',
    'SETTLEMENT_VERIFIED','FULFILLMENT_STARTED','DELIVERY_PROVED','CUSTOMER_ACCEPTED'];
  types.forEach((t,i)=>o=step(o,t,i));
  assert.equal(o.status,'COMPLETED');
  assert.equal(o.customer_acceptance_verified,true);
  assert.equal(o.externally_settled,true);
 }
});
test('browser redirect alone never verifies payment or delivery',()=>{
 let o=step(start(),'STOCK_HELD',1);
 assert.throws(()=>step(o,'SETTLEMENT_VERIFIED',2),/ILLEGAL/);
 o=step(o,'CHECKOUT_OPENED',3);
 assert.throws(()=>advance(o,{type:'PAYMENT_REPORTED',event_id:'synthetic-event-44',
   order_id:o.order_id,silo_id:o.silo_id,authenticated_source:'browser',evidence_sha256:hash,
   currency:'NZD',amount_minor:1200}),/UNTRUSTED/);
});
test('wrong currency or quantity is not settled',()=>{
 let o=step(step(start(),'STOCK_HELD',1),'CHECKOUT_OPENED',2);
 assert.throws(()=>advance(o,{type:'PAYMENT_REPORTED',event_id:'synthetic-event-44',
   order_id:o.order_id,silo_id:o.silo_id,authenticated_source:'signed_provider',
   evidence_sha256:hash,currency:'USD',amount_minor:1200}),/MISMATCH/);
});
test('cross-silo and mismatched order evidence is rejected',()=>{
 const o=start('mtg');
 assert.throws(()=>advance(o,{type:'STOCK_HELD',event_id:'synthetic-event-44',
  silo_id:'baby-kids',order_id:o.order_id,authenticated_source:'trusted_stock',
  evidence_sha256:hash}),/CROSS_SILO/);
});
test('replayed events never advance twice; altered event conflicts',()=>{
 const o=step(start(),'STOCK_HELD',1);
 const event={type:'STOCK_HELD',event_id:'synthetic-event-1',silo_id:o.silo_id,
  order_id:o.order_id,authenticated_source:'trusted_stock',evidence_sha256:hash};
 assert.equal(advance(o,event).status,'RESERVED');
 assert.equal(advance(o,event).replayed,true);
 assert.throws(()=>advance(o,{...event,evidence_sha256:'b'.repeat(64)}),/REPLAY_CONFLICT/);
});
test('no fulfillment or buyer confirmation before independently reconciled settlement',()=>{
 let o=step(step(start(),'STOCK_HELD',1),'CHECKOUT_OPENED',2);
 o=step(o,'PAYMENT_REPORTED',3);
 assert.throws(()=>step(o,'FULFILLMENT_STARTED',4),/ILLEGAL/);
 assert.throws(()=>step(o,'CUSTOMER_ACCEPTED',5),/ILLEGAL/);
});
test('refund requires independently confirmed refund settlement',()=>{
 let o=start();
 ['STOCK_HELD','CHECKOUT_OPENED','PAYMENT_REPORTED','SETTLEMENT_VERIFIED']
  .forEach((t,i)=>o=step(o,t,i));
 o=step(o,'REFUND_REQUESTED',10);
 assert.equal(o.status,'REFUND_PENDING');
 assert.throws(()=>step(o,'CUSTOMER_ACCEPTED',11),/ILLEGAL/);
 o=step(o,'REFUND_SETTLED',12);
 assert.equal(o.status,'REFUNDED');
});
