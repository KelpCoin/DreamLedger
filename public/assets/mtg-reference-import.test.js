'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const x=require('./mtg-reference-import.js');
test('public HTTPS posts can be linked without scraping or publishing',()=>{
 const r=x.previewReference({url:'https://www.reddit.com/r/magicTCG/comments/abc?utm_source=copy&foo=1#top',handle:'nztrader'});
 assert.equal(r.url,'https://www.reddit.com/r/magicTCG/comments/abc?foo=1');
 assert.equal(r.verification,'SELF_SUBMITTED_UNVERIFIED');
 assert.equal(r.reputation_credit,0);
 assert.equal(r.verified_sales,0);
 assert.equal(r.public_visibility,'PRIVATE_DRAFT');
});
test('prevent local endpoints and credentialed URLs',()=>{
 for(const url of ['http://reddit.com/post','https://localhost/a','https://127.0.0.1/x',
   'https://192.168.1.1/x','https://user:pass@example.com','javascript:alert(1)']){
   assert.throws(()=>x.safeUrl(url));
 }
});
test('parse NZD amount from pasted listing without inventing payment or listing',()=>{
 const p=x.previewListing('Sol Ring - Commander Masters\nNZ$12.50\nCondition: LP');
 assert.equal(p.price_nzd,12.5);
 assert.equal(p.published,false);
 assert.equal(p.import_status,'UNVERIFIED_PRIVATE_DRAFT');
});
test('unknown price stays unknown',()=>{
 const p=x.previewListing('Mox Amber\nmessage seller for pricing');
 assert.equal(p.price_nzd,null);
});
test('accept bounded JSON export with no posting',()=>{
 const p=x.previewListing(JSON.stringify({title:'Arcane Signet',condition:'Near Mint',price_nzd:20}));
 assert.equal(p.title,'Arcane Signet');
 assert.equal(p.price_nzd,20);
 assert.equal(p.requires_seller_confirmation,true);
});
test('reject unsafe reference control chars',()=>{
 assert.throws(()=>x.previewReference({url:'https://example.org/a',note:'fake\nstatus'}));
});
