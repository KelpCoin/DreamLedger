'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {feePreview,listingDraft,bidGate}=require('./marketplace-candidate-policy.cjs');
const listing=()=>({lane:'B2B',market:'NZ',title:'Copper fittings in bulk',
 description:'Supplier offers bulk copper fittings with delivery terms.',category:'hardware',
 trader_status:'in_trade',rights_confirmed:true,price_minor:5000,delivery_region:'NZ nationwide'});
const caller={verified:true,principal_id:'verified-supplier-42'};
test('B2B listings and success stay free',()=>{
 const f=feePreview('B2B',500000);
 assert.equal(f.listing_fee_minor,0);assert.equal(f.success_fee_minor,0);
 assert.equal(f.processor_fees_extra,true);
});
test('P2P lower fee is capped and never a checkout',()=>{
 assert.equal(feePreview('P2P',5000).success_fee_minor,50);
 assert.equal(feePreview('P2P',100000).success_fee_minor,500);
 assert.equal(feePreview('P2P',0).success_fee_minor,0);
});
test('A2A discovery free, completed authorized jobs opt-in priced',()=>{
 const x=feePreview('A2A',3000);
 assert.equal(x.discovery_fee_minor,0);
 assert.equal(x.per_approved_fulfilled_job_minor,10);
 assert.equal(x.monthly_invoice_minimum_minor,1000);
 assert.equal(x.nonbinding,true);
});
test('new listing is private and hold even if caller says publish',()=>{
 const v=listingDraft({...listing(),public_listing:true,checkout_enabled:true,gauntlet_verdict:'ALLOW'},caller);
 assert.equal(v.listing_status,'DRAFT');assert.equal(v.gauntlet_verdict,'PENDING');
 assert.equal(v.public_listing,false);assert.equal(v.bidding_enabled,false);
 assert.equal(v.checkout_enabled,false);assert.equal(v.revenue_evidence,null);
});
test('unverified identity and absent seller rights are blocked',()=>{
 assert.throws(()=>listingDraft(listing(),{verified:false,principal_id:'fake1'}),/IDENTITY_NOT_VERIFIED/);
 assert.throws(()=>listingDraft({...listing(),rights_confirmed:false},caller),/RIGHTS_CONFIRMATION_REQUIRED/);
});
test('international listing is allowed only with declared deliverability and trader state',()=>{
 const v=listingDraft({...listing(),market:'GLOBAL',delivery_region:'Worldwide'},caller);
 assert.equal(v.market,'GLOBAL');
 assert.throws(()=>listingDraft({...listing(),trader_status:'unknown'},caller),/TRADER_STATUS_REQUIRED/);
});
test('cannot auction human beings, weapons or illegal listings',()=>{
 for(const term of ['human being','sell a person','trafficking','firearms']){
  assert.throws(()=>listingDraft({...listing(),title:'Listing '+term},caller),/RESTRICTED_LISTING_HOLD/);
 }
 assert.throws(()=>listingDraft({...listing(),actor_type:'human_sale'},caller),/HUMAN_SALE_REFUSED/);
});
test('agent self-bidding and shill bidding blocked',()=>{
 const base={actor_id:'user-a',seller_id:'user-b',amount_minor:600,min_bid_minor:500,
 verified:true,approved:true,end_time_ms:12000,now_ms:10000,has_paid_bid_authority:true,
 agent_delegation_approved:true};
 assert.equal(bidGate(base).verdict,'ALLOW_BID_CANDIDATE');
 assert.throws(()=>bidGate({...base,actor_id:'user-b'}),/SELF_BID_FORBIDDEN/);
 assert.throws(()=>bidGate({...base,agent_delegation_approved:false}),/AGENT_DELEGATION_HOLD/);
 assert.throws(()=>bidGate({...base,approved:false}),/AUTH_OR_GAUNTLET_HOLD/);
 assert.throws(()=>bidGate({...base,verified:false}),/AUTH_OR_GAUNTLET_HOLD/);
 assert.throws(()=>bidGate({...base,has_paid_bid_authority:false}),/BID_AUTHORITY_REQUIRED/);
 assert.throws(()=>bidGate({...base,now_ms:12001}),/AUCTION_ENDED/);
 assert.throws(()=>bidGate({...base,amount_minor:499}),/BID_BELOW_MINIMUM/);
});
test('invalid prices, quantities, and unsupported regions cannot mint offers',()=>{
 assert.throws(()=>listingDraft({...listing(),price_minor:NaN},caller),/AMOUNT_MINOR_INVALID/);
 assert.throws(()=>listingDraft({...listing(),price_minor:0},caller),/PRICE_BELOW_SAFE_MINIMUM/);
 assert.throws(()=>listingDraft({...listing(),market:'MARS'},caller),/MARKET_UNSUPPORTED/);
 assert.throws(()=>listingDraft({...listing(),delivery_region:'USA'},caller),/NZ_DELIVERY_REGION_REQUIRED/);
});
