'use strict';

// Internal reconciliation adapter only. NEVER mount as an HTTP route.
// The webhook inbox's PAYMENT_REPORTED state is NOT settled payment evidence.
// This requires a verified reconciliation process to mark both the existing
// commercial payment and the attributable order before the grant becomes valid.
const INSERT = [
 "INSERT INTO public.dreammeez_entitlements",
 "(account_id,item_id,sku,source_event_id,source_payment_id)",
 "SELECT $1,$2,$3,p.event_id,p.payment_id",
 "FROM public.commercial_payments p",
 "JOIN public.commercial_orders o ON o.order_id=p.order_id",
 "JOIN public.commercial_offers f ON f.offer_id=o.offer_id",
 "JOIN public.stripe_event_inbox e ON e.event_id=p.event_id",
 "WHERE p.payment_id=$4",
 "AND p.status='SETTLED_VERIFIED' AND o.status='SETTLED_VERIFIED'",
 "AND p.livemode=TRUE AND e.livemode=TRUE",
 "AND o.buyer_reference=$1",
 "AND o.stripe_payment_intent_id=p.stripe_payment_intent_id",
 "AND f.sku=$3 AND f.silo_id='dreammeez'",
 "AND p.amount_cents=f.price_cents AND p.amount_cents=o.amount_cents",
 "AND upper(p.currency)=upper(f.currency)",
 "AND upper(o.currency)=upper(f.currency)",
 "ON CONFLICT DO NOTHING",
 "RETURNING account_id,item_id,sku,source_event_id,source_payment_id,grant_status,granted_at"
].join(' ');

const OWNED="SELECT item_id FROM public.dreammeez_entitlements WHERE account_id=$1 AND grant_status='active' ORDER BY item_id LIMIT 200";
function assertAccount(id) {
 if(typeof id!=='string'||!/^u_[a-f0-9]{24}$/.test(id))throw Error('INVALID_AUTHENTICATED_PRINCIPAL');
}
function assertItem(id) {
 if(typeof id!=='string'||!/^[a-z0-9-]{3,64}$/.test(id))throw Error('INVALID_ITEM');
}
function createService(query) {
 if(typeof query!=='function')throw Error('NEON_QUERY_REQUIRED');
 return {
   async grantEntitlement({accountId,itemId,sku,paymentId}) {
     assertAccount(accountId);assertItem(itemId);
     if(typeof sku!=='string'||sku.length<3||sku.length>128||
        typeof paymentId!=='string'||!/^checkout:cs_[A-Za-z0-9_]{8,128}$/.test(paymentId))
       throw Error('INVALID_PAYMENT_EVIDENCE_KEY');
     const result=await query(INSERT,[accountId,itemId,sku,paymentId]);
     if(!Array.isArray(result))throw Error('INVALID_DB_REPLY');
     if(result.length!==1)return {state:'HOLD_PAYMENT_OR_IDENTITY_NOT_VERIFIED',granted:false};
     return {state:'GRANTED_FROM_RECONCILED_PAYMENT',granted:true,
             item_id:result[0].item_id};
   },
   async getOwnedItemIds(accountId) {
     assertAccount(accountId);
     const rows=await query(OWNED,[accountId]);
     if(!Array.isArray(rows))throw Error('INVALID_DB_REPLY');
     return rows.map(r=>r.item_id).filter(id=>typeof id==='string'&&/^[a-z0-9-]{3,64}$/.test(id));
   },
   async hasEntitlement(accountId,itemId) {
     assertItem(itemId);
     return (await this.getOwnedItemIds(accountId)).includes(itemId);
   }
 };
}
module.exports={createService,INSERT,OWNED};
