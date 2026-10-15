'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const product = JSON.parse(fs.readFileSync(path.join(root, 'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json'), 'utf8'));
const offers = JSON.parse(fs.readFileSync(path.join(root, 'catalog/offers/approved.json'), 'utf8'));
const publicPage = fs.readFileSync(path.resolve(root, '..', '..', 'public/mtg/master.html'), 'utf8');

assert.equal(product.status, 'held', 'product must remain held');
assert.equal(product.checkout?.mode, 'disabled', 'held product must not enable checkout');
assert.equal(product.commercial_truth?.sellable, false, 'held product must not claim it can be sold');
assert.equal(product.fulfillment?.mode, 'disabled', 'fulfillment must not be advertised as ready');
assert.equal(product.fulfillment?.operator_required, true, 'operator requirement must agree with the held state');

const entry = registry.entries?.['COMMANDER-DECK-DIAGNOSTIC-001'];
assert.ok(entry, 'fulfillment registry entry must exist');
assert.equal(entry.ready, false, 'registry must not claim fulfillment readiness');
assert.equal(entry.operator_required, true, 'registry must not claim zero-human fulfillment');
assert.match(entry.reason || '', /HOLD/i, 'registry reason must explicitly record the hold');

assert.equal((offers.approved || []).some(x => x.offer_id === 'OFFER-CMD-DIAG-29-NZD'), false,
  'held Commander offer must not be included in approved checkout catalog');
const held = (offers.held || []).filter(x => x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
assert.equal(held.length, 1, 'held offer must remain in the audit catalog');
assert.equal(held[0].status, 'HELD');
assert.equal(held[0].payment_link_url, null, 'public compiler source must not expose a paid link for the held offer');
assert.equal(held[0].payment_link_status, 'HELD_NOT_PROMOTED');

assert.doesNotMatch(publicPage, /buy\.stripe\.com\//i, 'public MTG master must not bypass the first-party fulfillment gate');
assert.doesNotMatch(publicPage, />\s*Buy diagnostic\s*</i, 'held public page must not show a buy CTA');
assert.match(publicPage, /temporarily held/i, 'public master must explain why the diagnostic is unavailable');
assert.match(publicPage, /does not accept payment/i, 'public master must explicitly say it does not take payment');

console.log(JSON.stringify({
  schema: 'DREAMLEDGER/MTG-DIAGNOSTIC-RELEASE-STATE/v1',
  status: 'PASS',
  verified: [
    'product held',
    'checkout disabled',
    'fulfillment registry not ready',
    'Commander excluded from approved offers',
    'historical offer retained in held audit catalog',
    'public MTG master has no direct Stripe bypass'
  ]
}, null, 2));
