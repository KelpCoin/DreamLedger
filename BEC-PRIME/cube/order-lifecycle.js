'use strict';
// CUBE internal commerce state machine. A caller must authenticate the event
// source before invoking this pure function. Browser input is NEVER authority.
const EDGES=Object.freeze({
 CREATED:{STOCK_HELD:['RESERVED','trusted_stock']},
 RESERVED:{CHECKOUT_OPENED:['CHECKOUT_OPEN','trusted_checkout'],
   RESERVATION_CANCELLED:['CANCELLED','trusted_stock']},
 CHECKOUT_OPEN:{PAYMENT_REPORTED:['PAYMENT_REPORTED','signed_provider'],
   CHECKOUT_EXPIRED:['CANCELLED','trusted_checkout']},
 PAYMENT_REPORTED:{SETTLEMENT_VERIFIED:['SETTLED','independent_reconciler']},
 SETTLED:{FULFILLMENT_STARTED:['FULFILLING','trusted_fulfillment'],
   REFUND_REQUESTED:['REFUND_PENDING','authenticated_buyer']},
 FULFILLING:{DELIVERY_PROVED:['DELIVERED','trusted_delivery'],
   REFUND_REQUESTED:['REFUND_PENDING','authenticated_buyer']},
 DELIVERED:{CUSTOMER_ACCEPTED:['COMPLETED','authenticated_buyer'],
   REFUND_REQUESTED:['REFUND_PENDING','authenticated_buyer']},
 COMPLETED:{REFUND_REQUESTED:['REFUND_PENDING','authenticated_buyer']},
 REFUND_PENDING:{REFUND_SETTLED:['REFUNDED','independent_reconciler']},
 REFUNDED:{},CANCELLED:{}
});
const PAYMENT_EVENTS=new Set(['CHECKOUT_OPENED','PAYMENT_REPORTED','SETTLEMENT_VERIFIED','REFUND_SETTLED']);
const EVIDENCE_REQUIRED=new Set(['STOCK_HELD','CHECKOUT_OPENED','PAYMENT_REPORTED',
 'SETTLEMENT_VERIFIED','FULFILLMENT_STARTED','DELIVERY_PROVED',
 'CUSTOMER_ACCEPTED','REFUND_REQUESTED','REFUND_SETTLED']);
function makeOrder({silo_id,order_id,item_id,currency,amount_minor,fulfillment_mode}) {
 if(typeof silo_id!=='string'||!/^[a-z0-9-]{2,48}$/.test(silo_id)||
   typeof order_id!=='string'||order_id.length<8||
   typeof item_id!=='string'||item_id.length<2||
   typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||
   !Number.isSafeInteger(amount_minor)||amount_minor<0||
   !['shipping','pickup','digital','service'].includes(fulfillment_mode))
   throw Error('INVALID_ORDER');
 return {schema:'CUBE/ORDER-LIFECYCLE/v1',order_id,silo_id,item_id,currency,
  amount_minor,fulfillment_mode,status:'CREATED',processed_events:{}};
}
function advance(order,event) {
 if(!order||!EDGES[order.status]||!event||typeof event!=='object')
   throw Error('INVALID_ORDER_EVENT');
 if(typeof event.event_id!=='string'||!/^[A-Za-z0-9_-]{12,128}$/.test(event.event_id))
   throw Error('INVALID_EVENT_ID');
 if(event.silo_id!==order.silo_id||event.order_id!==order.order_id)
   throw Error('CROSS_SILO_OR_ORDER_EVENT');
 const previous=order.processed_events?.[event.event_id];
 if(previous){
  if(previous!==event.evidence_sha256)throw Error('EVENT_REPLAY_CONFLICT');
  return {...order,replayed:true};
 }
 const edge=EDGES[order.status][event.type];
 if(!edge)throw Error('ILLEGAL_COMMERCE_TRANSITION');
 if(event.authenticated_source!==edge[1])throw Error('UNTRUSTED_EVENT_SOURCE');
 if(EVIDENCE_REQUIRED.has(event.type) &&
    (typeof event.evidence_sha256!=='string'||!/^[a-f0-9]{64}$/.test(event.evidence_sha256)))
   throw Error('MISSING_PROVENANCE');
 if(PAYMENT_EVENTS.has(event.type) &&
   (event.currency!==order.currency||event.amount_minor!==order.amount_minor))
   throw Error('PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH');
 return {...order,status:edge[0],
  processed_events:{...order.processed_events,[event.event_id]:event.evidence_sha256||'unverified'},
  last_evidence_sha256:event.evidence_sha256||null,
  replayed:false,
  externally_settled:Boolean(order.externally_settled)||edge[0]==='SETTLED',
  customer_acceptance_verified:Boolean(order.customer_acceptance_verified)||edge[0]==='COMPLETED',
  refund_verified:edge[0]==='REFUNDED',
  net_revenue_proved:false};
}
module.exports={EDGES,makeOrder,advance};
