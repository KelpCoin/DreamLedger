'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { FILES, readJson, productIn } = require('../scripts/reconcile-edh-0001-catalog.cjs');

const expectedPrice = Number(process.env.CANONICAL_EDH_0001_PRICE_NZD);
assert.ok(Number.isSafeInteger(expectedPrice) && expectedPrice > 0,
  'Set CANONICAL_EDH_0001_PRICE_NZD to the owner-approved integer NZD price.');

function consumerPrice(relativePath) {
  const document = readJson(relativePath);
  const product = productIn(document, relativePath);
  if (relativePath.endsWith('catalog/products/EDH_0001.json') || relativePath.endsWith('configurator/EDH_0001.json')) {
    return relativePath.endsWith('configurator/EDH_0001.json')
      ? document.base_price_minor / 100
      : document.price / 100;
  }
  if (relativePath.endsWith('BEC-PRIME/catalog/products/EDH_0001.json')) return document.price / 100;
  return product.price;
}

test('every consumer-facing EDH_0001 feed resolves to the owner-approved NZD price', () => {
  assert.equal(FILES.length, 7);
  for (const relativePath of FILES) {
    assert.equal(consumerPrice(relativePath), expectedPrice, `${relativePath} price mismatch`);
  }
});

test('the EDH_0001 sources remain held with zero stock and checkout disabled', () => {
  for (const relativePath of FILES) {
    const document = readJson(relativePath);
    const product = productIn(document, relativePath);
    assert.equal((product.status || document.status)?.toLowerCase(), 'held', `${relativePath} must be held`);
    if ('inventory' in product) assert.equal(product.inventory, 0, `${relativePath} must not assert stock`);
    if ('checkout_available' in product) assert.equal(product.checkout_available, false, `${relativePath} checkout must stay off`);
    if (relativePath.endsWith('BEC-PRIME/catalog/products/EDH_0001.json')) {
      assert.equal(document.checkout.enabled, false);
      assert.equal(document.commercial_truth.payment_link, null);
    }
  }
});
