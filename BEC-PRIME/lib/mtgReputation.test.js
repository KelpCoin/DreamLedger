'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reputation}=require('./mtgReputation.js');
const rec=(id,buyer='buyer-'+id)=>({
 id,silo:'mtg',seller_id:'seller-a',buyer_id:buyer,
 source:'INDEPENDENT_PROVIDER_RECONCILED',
 payment_id:'pi_'+id,delivery_sha256:'b'.repeat(64),
 payment_settled:true,delivery_confirmed:true,
 independent_counterparty_confirmed:true,outcome:'positive'
});
test('new sellers are unrated, never portrayed as zero-star',()=>{
 const r=reputation('seller-a',[],[]);
 assert.equal(r.score_0_to_100,null);assert.equal(r.status,'NEW_NO_VERIFIED_TRANSACTIONS');
});
test('imported references have exactly zero score credit regardless of quantity',()=>{
 const refs=Array.from({length:700},()=>({verification:'OWNERSHIP_VERIFIED_BY_INDEPENDENT_PROOF'}));
 const r=reputation('seller-a',[],refs);
 assert.equal(r.score_0_to_100,null);assert.equal(r.external_reference_score_credit,0);
 assert.equal(r.external_ownership_verified_count,700);
});
test('verified delivered payment and independent buyer can establish score',()=>{
 const r=reputation('seller-a',[rec('001'),rec('002'),rec('003')],[]);
 assert.equal(r.verified_transactions,3);assert(r.score_0_to_100>0);
 assert(r.score_0_to_100<100);
});
test('self purchase, missing settlement and wrong silo are rejected',()=>{
 const a=rec('a');a.buyer_id='seller-a';
 const b=rec('b');b.payment_settled=false;
 const c=rec('c');c.silo='avatar';
 const r=reputation('seller-a',[a,b,c]);
 assert.equal(r.verified_transactions,0);assert.equal(r.ignored_unverified_receipts,3);
});
test('duplicate receipt and payment count only once',()=>{
 const a=rec('1'),b=rec('2');b.payment_id='pi_1';
 const r=reputation('seller-a',[a,a,b]);
 assert.equal(r.verified_transactions,1);
});
test('negative verified event reduces score',()=>{
 const good=reputation('seller-a',[rec('1'),rec('2'),rec('3')]);
 const bad=rec('4');bad.outcome='negative';
 const mixed=reputation('seller-a',[rec('1'),rec('2'),rec('3'),bad]);
 assert(mixed.score_0_to_100<good.score_0_to_100);
});

test('independently evidenced card-for-card swaps build reputation with zero payment',()=>{
 const swap={id:'swap-proof-1',kind:'trade',trade_id:'trade_abc1',
   silo:'mtg',seller_id:'seller-a',buyer_id:'separate-user-9',
   source:'INDEPENDENT_TRADE_EVIDENCE_RECONCILED',
   counterparty_verified_independently:true,item_exchange_verified_independently:true,
   delivery_sha256:'c'.repeat(64),delivery_confirmed:true,
   independent_counterparty_confirmed:true,outcome:'positive'};
 const r=reputation('seller-a',[swap]);
 assert.equal(r.verified_transactions,1);
 assert(r.score_0_to_100!==null);
 assert.equal(r.external_reference_score_credit,0);
});
test('two anonymous self-issued trade tokens alone cannot buy reputation',()=>{
 const swap={id:'swap-fake-1',kind:'trade',trade_id:'trade_fake',
   silo:'mtg',seller_id:'seller-a',buyer_id:'unverified-buyer',
   source:'PEER_ATTESTED_ONLY',
   delivery_sha256:'d'.repeat(64),delivery_confirmed:true,
   independent_counterparty_confirmed:true,outcome:'positive'};
 const r=reputation('seller-a',[swap]);
 assert.equal(r.score_0_to_100,null);
 assert.equal(r.verified_transactions,0);
});

test('one repeat trading partner cannot manufacture a high seller score',()=>{
 const receipts=Array.from({length:25},(_,i)=>rec('repeat'+i,'same-buyer'));
 const r=reputation('seller-a',receipts);
 assert.equal(r.verified_transactions,1);
 assert.equal(r.unique_verified_counterparties,1);
 assert.equal(r.ignored_unverified_receipts,24);
 assert(r.score_0_to_100<100);
});
