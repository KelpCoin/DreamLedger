'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'beck-auction-contract-'));
process.env.AUCTION_DATA_PATH=path.join(tmp,'auctions.json');
process.env.AUCTION_PROOF_DIR=path.join(tmp,'proof');
const auction=require('../../BEC-PRIME/auction-engine');
const {quoteUniversalMarketplaceFee,calculateMarketplaceFee}=require('../../BEC-PRIME/lib/marketplacePolicy');
const {diagnose}=require('./marketplace-self-build.cjs');
after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
const read=()=>JSON.parse(fs.readFileSync(process.env.AUCTION_DATA_PATH,'utf8'));
const set=data=>fs.writeFileSync(process.env.AUCTION_DATA_PATH,JSON.stringify(data));
const later=Date.now()+3600000;
test('creator makes a quarantined candidate, cannot approve via input',()=>{
 const a=auction.createAuction({silo:'SILO_B2B',title:'NZ secondhand office desks',start_price:100,
  ends_at:later,approved:true,seller_verified:true,gauntlet_verdict:'ALLOW',
  approval_required:false,checkout_available:true});
 assert.equal(a.checkout_available,false);
 assert.equal(a.approval_required,true);
 assert.equal(a.gauntlet_verdict,'HOLD');
 assert.equal(auction.listAuctions().length,0);
 assert.equal(read().auctions[0].status,'DRAFT');
});
test('unauthenticated browser bids fail closed under all conditions',()=>{
 assert.throws(()=>auction.placeBid('AUC-123','web_anonymous',10),/AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED/);
 assert.equal(fs.existsSync(process.env.AUCTION_PROOF_DIR),false);
});
test('expired lots never reactivate or mutate persisted state on reads',()=>{
 set({auctions:[{auction_id:'AUC-EXP',silo:'SILO_MTG',title:'expired',
  status:'APPROVED',approved:true,seller_verified:true,gauntlet_verdict:'ALLOW',
  approval_required:false,starts_at:1,ends_at:1,start_price:10,currency:'NZD',
  minimum_increment:1}],bids:[]});
 const before=fs.readFileSync(process.env.AUCTION_DATA_PATH);
 assert.deepEqual(auction.listAuctions(),[]);
 assert.equal(auction.getAuction('AUC-EXP'),null);
 assert.deepEqual(fs.readFileSync(process.env.AUCTION_DATA_PATH),before);
});
test('only verified, approved, unexpired lots display as non-biddable previews',()=>{
 set({auctions:[
  {auction_id:'AUC-YES',silo:'SILO_B2B',title:'verified',status:'APPROVED',
   approved:true,seller_verified:true,gauntlet_verdict:'ALLOW',approval_required:false,
   starts_at:1,ends_at:later,start_price:50,currency:'NZD',minimum_increment:1},
  {auction_id:'AUC-NO',silo:'SILO_AVATAR',title:'unscreened',status:'APPROVED',
   approved:true,seller_verified:false,gauntlet_verdict:'HOLD',approval_required:false,
   starts_at:1,ends_at:later,start_price:3,currency:'NZD',minimum_increment:1}
 ],bids:[{auction_id:'AUC-YES',bidder_id:'faked',amount:900000}]});
 const items=auction.listAuctions();
 assert.equal(items.length,1);
 assert.equal(items[0].auction_id,'AUC-YES');
 assert.equal(items[0].checkout_available,false);
 assert.equal(items[0].bid_count,0);
 assert.equal(items[0].current_price,50);
});
test('silo isolation and draft-only creation',()=>{
 assert.throws(()=>auction.createAuction({silo:'SILO_ADULT',title:'wrong silo',start_price:1,ends_at:later}),/SILO_NOT_ALLOWED/);
 assert.throws(()=>auction.createAuction({silo:'SILO_MTG',title:'bad amount',start_price:-3,ends_at:later}),/PRICE_OR_WINDOW/);
});
test('B2B base and P2P peer have zero platform fees, no fake free processing',()=>{
 for(const lane of ['B2B','P2P']){
   const x=quoteUniversalMarketplaceFee({lane,amountMinor:250000,currency:'NZD',sellerCountry:'NZ'});
   assert.equal(x.platformFeeMinor,0);
   assert.equal(x.listingPlatformFeeMinor,0);
   assert.equal(x.processingFeesIncluded,false);
   assert.equal(x.externalCheckoutAuthority,false);
 }
});
test('A2A quote capped at NZD 5, no guaranteed settlement worldwide',()=>{
 const small=quoteUniversalMarketplaceFee({lane:'A2A',amountMinor:10000,currency:'NZD',sellerCountry:'NZ'});
 const large=quoteUniversalMarketplaceFee({lane:'A2A',amountMinor:200000,currency:'NZD',sellerCountry:'US'});
 assert.equal(small.platformFeeMinor,100);
 assert.equal(large.platformFeeMinor,500);
 assert.equal(large.crossBorderPayoutsApproved,false);
 assert.equal(large.paymentRail,'UNVERIFIED');
 assert.equal(large.pricingState,'CANDIDATE_NOT_PUBLIC_OFFER');
});
test('no invalid money, currency, or unrecognized lane can quote',()=>{
 assert.throws(()=>quoteUniversalMarketplaceFee({lane:'A2A',amountMinor:NaN,currency:'NZD',sellerCountry:'NZ'}),/INVALID/);
 assert.throws(()=>quoteUniversalMarketplaceFee({lane:'A2A',amountMinor:12.8,currency:'NZD',sellerCountry:'NZ'}),/INVALID/);
 assert.throws(()=>quoteUniversalMarketplaceFee({lane:'B2B',amountMinor:100,currency:'USD',sellerCountry:'NZ'}),/FX/);
 assert.throws(()=>quoteUniversalMarketplaceFee({lane:'AUCTION',amountMinor:100,currency:'NZD',sellerCountry:'NZ'}),/UNKNOWN/);
});
test('legacy 5% external seller pricing remains untouched until pricing migration',()=>{
 const old=calculateMarketplaceFee('outside-seller','OTHER',100);
 assert.equal(old.percentage,5);
});
test('existing self-repair Gauntlet sees repaired auction source and page as safe',()=>{
 const root=path.resolve(__dirname,'../..');
 const engine=fs.readFileSync(path.join(root,'BEC-PRIME/auction-engine.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'public/auctions.html'),'utf8');
 assert.deepEqual(diagnose(engine,html),[]);
 assert(!html.includes('localStorage'));
 assert(!html.includes("local_sandbox"));
 assert(!/a\.ends_at\s*=\s*t\s*\+/.test(engine));
});
