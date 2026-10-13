'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeMarketplaceSku } = require('../routes/commercialCell');

const cases = [
  ['COMMANDER-DECK-DIAGNOSTIC-001', 'COMMANDER-DECK-DIAGNOSTIC-001'],
  ['CMD-DIAG-29', 'COMMANDER-DECK-DIAGNOSTIC-001'],
  ['MTG_CMD_DIAG_001', 'MTG_CMD_DIAG_001'],
  ['OFFER-CMD-DIAG-29-NZD', 'OFFER-CMD-DIAG-29-NZD'],
  ['QUOTE-COMPARE-49', 'QUOTE-COMPARE-49'],
  ['', ''],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeMarketplaceSku(input), expected, 'normalization for ' + input);
}
const product = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/catalog.json'), 'utf8'));
const publicProduct = catalog.products.find(x => x.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
assert.ok(publicProduct, 'Commander diagnostic must exist in public catalog');
assert.equal(product.commercial_truth.payment_link_id, 'plink_1UFFZFEGgEAnUFF9LHNMWTDl');
assert.equal(publicProduct.payment_link_id, product.commercial_truth.payment_link_id);
assert.equal(publicProduct.checkout_url, product.commercial_truth.payment_link);
assert.equal(publicProduct.checkout_available, true);
console.log('PASS: Commander diagnostic aliases normalize and canonical source/public catalog point at the same live Stripe link.');
