'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {diagnose,repairSources}=require('./marketplace-self-build.cjs');
const root=path.resolve(__dirname,'../..');
test('current safe candidate has no critical marketplace regression',()=>{
 const e=fs.readFileSync(path.join(root,'BEC-PRIME/auction-engine.js'),'utf8');
 const p=fs.readFileSync(path.join(root,'public/auctions.html'),'utf8');
 assert.deepEqual(diagnose(e,p),[]);
});
test('Gauntlet catches synthetic browser bids, old checkout and auction reanimation',()=>{
 const e=[
 "function placeBid(x) {return {bid_id:x};}",
 "function refreshExpired(state){a.ends_at = t + 999;}",
 "function listAuctions(silo){return [];}",
 "function getAuction(id){return null;}",
 "checkout_available: a.checkout_available === true && status !== 'ended' && reserveMet",
 "module.exports={placeBid};"
 ].join('\n');
 const p="<script>const demoLots=[];const id=localStorage.getItem('bidder');</script>";
 const issues=diagnose(e,p);
 assert(issues.includes('EXPIRED_AUCTION_REANIMATION'));
 assert(issues.includes('UNVERIFIED_CHECKOUT_EXPOSURE'));
 assert(issues.includes('UNVERIFIED_BID_EXECUTOR'));
 assert(issues.includes('SYNTHETIC_BROWSER_AUCTION'));
 const repaired=repairSources(e,p);
 assert(!repaired.engine.includes('a.ends_at = t +'));
 assert(repaired.engine.includes("AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED"));
 assert(!repaired.page.includes('demoLots'));
 assert(repaired.page.includes('Bidding is held.'));
 // Repair proposals are candidates only; cross-check against real tests and review.
});
test('Gauntlet rejects unapproved seller and missing hold UI',()=>{
 const v=diagnose("function placeBid(){throw new Error('AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED');}","<html></html>");
 assert(v.includes('SELLER_GAUNTLET_UNBOUND'));
 assert(v.includes('BID_UI_NOT_FAIL_CLOSED'));
});
test('no ability to change price, Stripe, DNS, or publish in bounded repair code',()=>{
 const source=fs.readFileSync(__dirname+'/marketplace-self-build.cjs','utf8');
 for(const path of ['STRIPE_SECRET_KEY','METRICOOL','CF_API_TOKEN','stripe.com/v1','supabase.co','api.github.com']){
   assert(!source.includes(path),'unexpected high-authority integration: '+path);
 }
});
