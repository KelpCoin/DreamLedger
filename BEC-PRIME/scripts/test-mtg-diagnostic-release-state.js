'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const product = JSON.parse(fs.readFileSync(path.join(root, 'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json'), 'utf8'));
const offers = JSON.parse(fs.readFileSync(path.join(root, 'catalog/offers/approved.json'), 'utf8'));
const featured = JSON.parse(fs.readFileSync(path.join(root, 'catalog/featured-offer.json'), 'utf8'));
const cube = JSON.parse(fs.readFileSync(path.join(root, 'cube/manifests/mtg-diagnostic.json'), 'utf8'));
const compiledDiagnostic = fs.readFileSync(path.join(root, 'compiled/website/mtg/diagnostic.html'), 'utf8');
const publicPage = fs.readFileSync(path.resolve(root, '..', 'public/mtg/master.html'), 'utf8');
const publicIndex = fs.readFileSync(path.resolve(root, '..', 'public/index.html'), 'utf8');
const publicShop = fs.readFileSync(path.resolve(root, '..', 'public/shop.html'), 'utf8');
const publicSilo = fs.readFileSync(path.resolve(root, '..', 'public/silos/commander-deck-diagnostic/index.html'), 'utf8');

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

assert.equal(featured.status, 'HELD');
assert.equal(featured.public_visibility, 'held');
assert.equal(featured.payment_link_url, null);
assert.equal(featured.checkout_url, null);
assert.equal(featured.payment_link_status, 'HELD_NOT_PROMOTED');
assert.equal(cube.sale_status, 'held');
assert.equal(cube.checkout_enabled, false);
assert.match(compiledDiagnostic, /Currently held/);
assert.match(compiledDiagnostic, /not available for purchase/);
assert.doesNotMatch(compiledDiagnostic, /NZ\\$29|\\/api\\/mtg\\/diagnostic\\/intake|buy\\.stripe\\.com/i);

assert.doesNotMatch(publicIndex, /\\/buy\\/COMMANDER-DECK-DIAGNOSTIC-001/i);
assert.doesNotMatch(publicShop, /Commander Deck Diagnostic/i);
assert.match(publicIndex, /temporarily held/i);
assert.match(publicSilo, /Currently held/i);
assert.doesNotMatch(publicSilo, /mailto:hello@dreamledger\\.org|buy\\.stripe\\.com/i);

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
    'featured offer is held and exposes no purchase URL',
    'CUBE release manifest and compiled status page are held',
    'public index and shop cannot expose a Commander checkout',
    'public MTG master has no direct Stripe bypass'
  ]
}, null, 2));
