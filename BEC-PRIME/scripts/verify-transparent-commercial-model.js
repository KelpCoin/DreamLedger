'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const parse = (p) => JSON.parse(read(p));
const commercial = parse('config/commercial-rules.json');
const publicCatalog = parse('data/mtg-catalog.json');
const feePolicy = require('../lib/siloFeePolicy');

assert.equal(commercial.principles.browsing.price_nzd, 0);
assert.equal(commercial.principles.listing_creation.price_nzd, 0);
assert.equal(commercial.principles.b2b_participation.platform_fee_bps, 0);
assert.equal(commercial.transaction_channels.human_to_human.platform_fee_bps, 0);
assert.equal(commercial.transaction_channels.machine_to_machine.platform_fee_bps, 200);
assert.equal(commercial.paid_visibility.enabled_by_default, false);
assert.match(read('config/feature-flags.yml'), /paid_visibility:\s*\n\s+enabled: false/);
assert.match(read('config/feature-flags.yml'), /a2a_x402:\s*\n\s+enabled: false/);

for (const silo of ['mtg','pokemon','lorcana','accounting','dental','unrelated']) {
  assert.equal(feePolicy.resolve(silo, 'human_to_human').platform_fee_bps, 0);
  assert.equal(feePolicy.resolve(silo, 'machine_to_machine').platform_fee_bps, 200);
}
assert.equal(feePolicy.canPromote({tenantPlan:{featured_listings:true},featureEnabled:false,paymentVerified:true,fulfillmentVerified:true}), false);
assert.equal(feePolicy.canPromote({tenantPlan:{featured_listings:true},featureEnabled:true,paymentVerified:false,fulfillmentVerified:true}), false);
assert.equal(feePolicy.canPromote({tenantPlan:{featured_listings:true},featureEnabled:true,paymentVerified:true,fulfillmentVerified:true}), true);
assert.equal(feePolicy.isPromoted({is_promoted:true}), true);
assert.equal(feePolicy.isPromoted({is_promoted:'true'}), false);

const expected = new Map([
  ['EDH_0001',230],
  ['EDH_QUINTORIUS_0002',90],
  ['EDH_DWYNEN_0003',90],
  ['EDH_JON_IRENICUS_0004',220],
  ['EDH_ALTAIR_0005',750],
  ['EDH_KWAIN_0006',650],
  ['EDH_ERRANT_GIADA_0007',300],
  ['EDH_MISERY_MEMORIAL_0008',180]
]);
const listings = publicCatalog.products.filter(p => p.category === 'commander-deck');
assert.equal(listings.length, expected.size, 'expected all eight Commander listings');
for (const [id, price] of expected) {
  const p = listings.find(item => item.id === id);
  assert.ok(p, 'missing listing ' + id);
  assert.equal(p.price, price, id + ' price mismatch');
  assert.equal(p.checkout_available, false, id + ' must remain checkout-disabled');
  assert.equal(p.payment_link, null, id + ' must not embed a payment link');
  assert.equal(p.sale_mode, 'request_to_purchase');
  assert.equal(p.detail_url, '/mtg/deck.html?id=' + encodeURIComponent(id));
}
for (const catalogPath of [
  'public/data/mtg-catalog.json',
  'BEC-PRIME/compiled/website/data/mtg-catalog.json'
]) {
  assert.deepEqual(parse(catalogPath), publicCatalog, catalogPath + ' catalogue mismatch');
}
const storefronts = [
  'BEC-PRIME/website/mtg-catalog.html',
  'BEC-PRIME/compiled/website/mtg/index.html',
  'mtg/index.html',
  'public/mtg/index.html'
];
const canonicalSurface = read(storefronts[0]);
for (const p of storefronts.slice(1)) assert.equal(read(p), canonicalSurface, p + ' storefront drift');
assert.ok(canonicalSurface.includes('data-filter="all"'));
assert.ok(canonicalSurface.includes('data-filter="decklists"'));
assert.ok(canonicalSurface.includes('data-filter="inventory"'));
assert.ok(canonicalSurface.includes("p.is_promoted===true"));
assert.ok(canonicalSurface.includes('checkout_authorized===true'));
assert.ok(!canonicalSurface.includes('https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I'));

const deckTemplates = [
  'BEC-PRIME/website/mtg/deck.html',
  'BEC-PRIME/compiled/website/mtg/deck.html',
  'mtg/deck.html',
  'public/mtg/deck.html'
];
const canonicalDeck = read(deckTemplates[0]);
for (const p of deckTemplates.slice(1)) assert.equal(read(p), canonicalDeck, p + ' detail template drift');
assert.ok(canonicalDeck.includes('Request to purchase'));
assert.ok(canonicalDeck.includes('location.href=\'mailto:hello@dreamledger.org'));
assert.ok(canonicalDeck.includes('p.checkout_available===true'));
assert.ok(canonicalDeck.includes('p.is_promoted===true'));
assert.ok(read('BEC-PRIME/compiler/MTGCatalogCompiler.js').includes('fs.copyFileSync(DECK_SOURCE, DECK_OUT)'));

const publicEdward = parse('catalog/products/EDH_0001.json');
const compiledEdward = parse('BEC-PRIME/catalog/products/EDH_0001.json');
assert.equal(publicEdward.price, 23000);
assert.equal(publicEdward.commercial_truth.checkout_available, false);
assert.equal(publicEdward.commercial_truth.payment_link, null);
assert.equal(compiledEdward.price, 23000);
assert.equal(compiledEdward.commercial_truth.checkout_available, false);
assert.equal(compiledEdward.commercial_truth.payment_link, null);
assert.equal(compiledEdward.commercial_truth.sellable, false);

console.log('PASS: transparent fees, optional disabled visibility, eight Commander listings, mirror parity, and checkout fail-closed rules.');
