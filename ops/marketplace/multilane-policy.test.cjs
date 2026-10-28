'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {LANES,assess,receipt}=require('./multilane-policy.cjs');
const basic={lane:'b2b',country:'NZ',currency:'NZD',silo:'SILO_MARKETPLACE_B2B',action:'DRAFT_LISTING',seller_in_trade:true};
test('basic B2B listing is free draft, not public',()=>{
 const r=assess(basic);assert.equal(r.decision,'DRAFT_ONLY');assert.equal(r.pricing.basic_listing_fee_minor,0);assert.equal(r.pricing.indicative_seller_fee_bps,0);assert.equal(r.public_action,false);
});
test('P2P fee is indicative 1 percent, not a charged fee',()=>{
 const r=assess({...basic,lane:'p2p',silo:'SILO_MARKETPLACE_P2P',seller_in_trade:false});
 assert.equal(r.pricing.indicative_seller_fee_bps,100);assert.equal(r.pricing.fee_finalized,false);
});
test('agent cannot order without verified authority',()=>{
 const p={...basic,lane:'a2a',silo:'SILO_MARKETPLACE_A2A',action:'DRAFT_ORDER'};
 assert.equal(assess(p).decision,'HOLD');
 assert.equal(assess({...p,agent_authority_verified:true}).decision,'DRAFT_ONLY');
});
test('bids cannot be submitted with unverified identities',()=>{
 const p={...basic,lane:'p2p',silo:'SILO_MARKETPLACE_P2P',action:'PROPOSE_BID'};
 assert.equal(assess(p).reason,'BIDDING_IDENTITY_NOT_VERIFIED');
 assert.equal(assess({...p,seller_verified:true,bidder_verified:true}).decision,'DRAFT_ONLY');
});
test('silos cannot cross',()=>{
 assert.equal(assess({...basic,silo:'SILO_ADULT'}).decision,'HOLD');
 assert.equal(assess({...basic,silo:'SILO_MTG'}).decision,'HOLD');
});
test('requires seller trader disclosure',()=>assert.equal(assess({...basic,seller_in_trade:null}).decision,'HOLD'));
test('unknown lane, currency and territory rejected',()=>{
 assert.equal(assess({...basic,lane:'anything'}).decision,'HOLD');
 assert.equal(assess({...basic,currency:'XXX'}).decision,'HOLD');
 assert.equal(assess({...basic,country:'world'}).decision,'HOLD');
});
test('public posting and payment always approval-gated',()=>{
 for(const field of ['requires_payment','requires_publication'])
 assert.equal(assess({...basic,[field]:true}).decision,'HOLD');
});
test('receipt deterministic and proves no money',()=>{
 const a=receipt(basic),b=receipt(basic);assert.deepEqual(a,b);
 assert.equal(a.actual_bid_placed,false);assert.equal(a.settlement_verified,false);
 assert.match(a.sha256,/^[a-f0-9]{64}$/);
});
test('all three lanes exist with free entry and no default publication',()=>{
 assert.deepEqual(Object.keys(LANES),['b2b','p2p','a2a']);
 for(const lane of Object.values(LANES))assert.equal(lane.basic_listing_fee_minor,0);
});
