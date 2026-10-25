import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=process.cwd();
const registry=JSON.parse(fs.readFileSync('BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('public/catalog.json','utf8'));
const candidate=fs.readFileSync('public/portfolio/supplier-quote-comparison-pilot.html','utf8');
const byId=id=>catalog.products.find(p=>p.id===id);

test('published checkout is not inferred from old automated readiness claims',()=>{
 for(const id of ['COMMANDER-DECK-DIAGNOSTIC-001','DREAMLEDGER-BILLBOARD-FOUNDING-001','QUOTE-COMPARE-49']){
  const c=byId(id);
  assert.ok(c,'product exists: '+id);
  assert.equal(c.checkout_available,false,'catalog held: '+id);
  assert.equal(registry.entries[id].ready,false,'fulfillment truth mirrors current hold: '+id);
 }
 assert.equal(registry.entries['BILLBOARD-SMALL'].ready,false);
 assert.equal(byId('COMMANDER-DECK-DIAGNOSTIC-001').status,'held');
 assert.equal(registry.entries['COMMANDER-DECK-DIAGNOSTIC-001'].operator_required,true,'Stripe live confirmation promises manual delivery');
});
test('unvalidated B2B pilot does not accept money or advertise false merchant markup',()=>{
 assert.match(candidate,/<meta name="robots" content="noindex,nofollow">/);
 assert.match(candidate,/NOT ACCEPTING PURCHASES/);
 assert.match(candidate,/NZ\$2,500/);
 assert.match(candidate,/UNKNOWN/);
 assert.match(candidate,/schema\.org/);
 assert.match(candidate,/"@type":"Service"/);
 assert.doesNotMatch(candidate,/"@type":"Offer"/);
 assert.doesNotMatch(candidate,/(?:buy\.stripe\.com|checkout_available|payment-link|<form)/i);
});
test('commercial release must remain blocked until full paid-to-delivery evidence',()=>{
 assert.match(registry.entries['COMMANDER-DECK-DIAGNOSTIC-001'].reason,/No paid-to-delivered receipt verified/);
 assert.match(registry.entries['OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001'].reason,/proof-of-placement/);
});
