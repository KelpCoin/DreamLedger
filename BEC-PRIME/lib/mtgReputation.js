'use strict';
/* MTG reputation: provider-reconciled completed trades only, never social popularity.
   Call only with independently verified first-party receipt data. */
const SHA256=/^[a-f0-9]{64}$/;
function validReceipt(x,ownerId){
 return !!(x&&typeof x==='object'&&x.source==='INDEPENDENT_PROVIDER_RECONCILED'&&
   x.silo==='mtg'&&x.seller_id===ownerId&&
   typeof x.buyer_id==='string'&&x.buyer_id.length>0&&x.buyer_id!==ownerId&&
   typeof x.id==='string'&&x.id.length>0&&
   typeof x.payment_id==='string'&&x.payment_id.length>2&&
   typeof x.delivery_sha256==='string'&&SHA256.test(x.delivery_sha256)&&
   x.payment_settled===true&&x.delivery_confirmed===true&&
   x.independent_counterparty_confirmed===true&&
   (x.outcome==='positive'||x.outcome==='negative'));
}
function wilsonLower(pos,total){
 if(total===0)return null;
 const z=1.96,p=pos/total,z2=z*z,d=1+z2/total;
 return Math.max(0,(p+z2/(2*total)-z*Math.sqrt((p*(1-p)+z2/(4*total))/total))/d);
}
function reputation(ownerId,receipts,references=[]){
 if(!ownerId||typeof ownerId!=='string')throw new Error('SELLER_ID_REQUIRED');
 if(!Array.isArray(receipts)||receipts.length>50000||
    !Array.isArray(references)||references.length>50000)throw new Error('INPUT_LIMIT');
 const ids=new Set(),payments=new Set();
 let positive=0,negative=0,ignored=0;
 for(const x of receipts){
   if(!validReceipt(x,ownerId)||ids.has(x.id)||payments.has(x.payment_id)){ignored++;continue;}
   ids.add(x.id);payments.add(x.payment_id);
   if(x.outcome==='positive')positive++;else negative++;
 }
 const total=positive+negative;
 const external=references.filter(x=>x&&x.verification==='OWNERSHIP_VERIFIED_BY_INDEPENDENT_PROOF').length;
 return Object.freeze({
   status:total?'VERIFIED_TRANSACTION_HISTORY':'NEW_NO_VERIFIED_TRANSACTIONS',
   score_0_to_100:total?Math.round(wilsonLower(positive,total)*100):null,
   model:'WILSON_95_LOWER_BOUND_VERIFIED_SETTLED_DELIVERED',
   verified_transactions:total,positive,negative,
   ignored_unverified_receipts:ignored,
   external_reference_count:references.length,
   external_ownership_verified_count:external,
   external_reference_score_credit:0,
   proof_requirement:'INDEPENDENT_PROVIDER_AND_COUNTERPARTY_EVIDENCE',
   silo:'mtg',
   warning:total?'Score describes proven outcomes, not a fraud guarantee.':'No verified deal history; not a negative rating.'
 });
}
module.exports={reputation,wilsonLower,validReceipt};
