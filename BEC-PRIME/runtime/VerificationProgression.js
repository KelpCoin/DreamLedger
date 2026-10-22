'use strict';
// Internal provenance-gated progression. No tokens, paid boosts or revenue guarantees.
const SHA=/^[a-f0-9]{64}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{1,79}$/;
function evaluate(template,receipts=[]){
 if(!template||!ID.test(template.template_id||'')||!ID.test(template.silo_id||''))throw Error('INVALID_TEMPLATE');
 let tested=0,delivered=0,commercial=0;const seen=new Set();
 for(const r of receipts){
  if(!r||r.template_id!==template.template_id||r.silo_id!==template.silo_id||!ID.test(r.receipt_id||'')||seen.has(r.receipt_id))continue;
  seen.add(r.receipt_id);
  if(r.status!=='VERIFIED'||!SHA.test(r.artifact_sha256||'')||!ID.test(r.source_reference||''))continue;
  if(r.kind==='TEST')tested++;
  if(r.kind==='FULFILLMENT'&&r.delivery_retrievable===true)delivered++;
  if(r.kind==='COMMERCIAL'&&r.external_buyer_verified===true&&r.settled_payment_verified===true&&r.delivery_retrievable===true&&r.reconciled===true)commercial++;
 }
 return Object.freeze({template_id:template.template_id,silo_id:template.silo_id,
  state:commercial?'REVENUE_PROVEN':delivered?'DELIVERY_PROVEN':tested?'TESTED':'CANDIDATE',
  passing_tests:tested,verified_deliveries:delivered,verified_commercial_outcomes:commercial,
  inferred_revenue_nzd:null});
}
function communityScore(siloId,receipts=[]){
 if(!ID.test(siloId||''))throw Error('INVALID_SILO');
 const seen=new Set();let deliveries=0;
 for(const r of receipts){
  if(!r||r.silo_id!==siloId||!ID.test(r.receipt_id||'')||seen.has(r.receipt_id))continue;
  seen.add(r.receipt_id);
  if(r.kind==='FULFILLMENT'&&r.status==='VERIFIED'&&r.delivery_retrievable===true&&SHA.test(r.artifact_sha256||'')&&ID.test(r.source_reference||''))deliveries++;
 }
 return Object.freeze({silo_id:siloId,verified_deliveries:deliveries,leaderboard_publication_authorized:false,tradable_reward:null});
}
module.exports={evaluate,communityScore};
