'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectListing}=require('./mtgMarketplaceGauntlet.js');
test('ordinary MTG sales and trade descriptions pass',()=>{
 const r=inspectListing({title:'Sol Ring',description:'Destroy target creature, win the game.',trade_wanted:'Looking for Commander staples'});
 assert.equal(r.decision,'PASS');
});
test('direct personal threats are quarantined before public listing',()=>{
 assert.equal(inspectListing({title:'Card',description:'I will physically hurt you.'}).decision,'QUARANTINE');
});
test('spam and excessive links require review',()=>{
 assert.equal(inspectListing({title:'Card',description:'https://a.nz https://b.nz https://c.nz'}).decision,'QUARANTINE');
 assert.equal(inspectListing({title:'Card',description:'Join our telegram for quick money'}).decision,'QUARANTINE');
});
test('untrusted markup rejected without rendering',()=>{
 assert.equal(inspectListing({title:'<script>bad()</script>'}).decision,'REJECT');
});
test('invalid input rejected, no silent approval',()=>{
 assert.equal(inspectListing(null).decision,'REJECT');
});
test('no ratings, money, publication or billing from moderation pass',()=>{
 const r=inspectListing({title:'Chrome Mox'});
 assert.equal(r.policy,'MTG_PEER_LISTING_RULEPACK_V1');
 assert.match(r.meaning,/not validation/);
});
