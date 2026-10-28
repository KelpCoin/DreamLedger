import assert from 'node:assert/strict';
import test from 'node:test';
import {classify,LINK_IDS} from './verify-billboard-money-gate.mjs';

const links=(active=true)=>LINK_IDS.map(id=>({id,known:true,live:true,active}));
test('held live page and active Stripe links is a first-class HOLD',()=>{
 const v=classify('<p>Checkout temporarily held</p>',links());
 assert.equal(v.verdict,'HOLD_ACTIVE_LINKS_WHILE_PUBLIC_OFFER_HELD');
 assert.equal(v.activeLinkedPayments,2);
 assert.equal(v.contradictory,true);
 assert.equal(v.authorizedToResumeCampaign,false);
});
test('held public offer never clears for paused link state',()=>{
 const v=classify('New purchases are paused',links(false));
 assert.equal(v.verdict,'HOLD_PUBLIC_OFFER');
});
test('uncertain Stripe observation fails closed',()=>{
 const v=classify('<a href="https://buy.stripe.com/foo">Reserve a tile securely</a>',
     [{id:LINK_IDS[0],known:false},{id:LINK_IDS[1],known:false}]);
 assert.equal(v.verdict,'UNVERIFIED_PAYMENT_LINKS');
});
test('even open checkout never claims delivery or automatic publication',()=>{
 const v=classify('<a href="https://buy.stripe.com/foo">Reserve a tile securely</a>',links());
 assert.equal(v.verdict,'REVIEW_REQUIRED_NOT_DELIVERY_PROOF');
 assert.equal(v.fulfillmentVerified,false);
 assert.equal(v.publicationAllowed,false);
 assert.equal(v.verifiedExternalRevenueNzd,null);
});
test('unrecognized page must not be treated as live checkout',()=>{
 const v=classify('<h1>Server error</h1>',links());
 assert.equal(v.verdict,'HOLD_NO_VALIDATED_CHECKOUT');
});
test('missing one link is not a valid all-clear',()=>{
 const v=classify('Reserve a tile securely',links().slice(0,1));
 assert.equal(v.verdict,'UNVERIFIED_PAYMENT_LINKS');
});
