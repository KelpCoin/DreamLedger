'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptProduct, productType, canonicalSourceUrl, priceMajor } = require('./PrepareCanonicalCatalog');

function readyProduct(overrides = {}) {
  return {
    id: 'FIXTURE-DIGITAL-001',
    silo: 'digital',
    name: 'Fixture digital kit',
    description: 'Synthetic test fixture only',
    price: 79,
    price_unit: 'major',
    status: 'published',
    checkout: { url: '/buy.html?sku=FIXTURE-DIGITAL-001' },
    commercial_truth: { sellable: true, approval_required: false },
    fulfillment: { mode: 'digital_download', operator_required: false },
    ...overrides
  };
}
const readyRegistry = { entries: { 'FIXTURE-DIGITAL-001': { ready: true, operator_required: false } } };

test('canonical product adapter stages only explicitly ready products', () => {
  const r = adaptProduct(readyProduct(), readyRegistry);
  assert.equal(r.status, 'ELIGIBLE_FOR_DRAFT_COMPILATION');
  assert.equal(r.product.product_type, 'digital_download');
  assert.equal(r.product.silo_id, 'digital_goods');
  assert.equal(r.product.source_url, 'https://dreamledger.org/buy.html?sku=FIXTURE-DIGITAL-001');
  assert.equal(r.product.price, 'NZD 79.00');
});

test('missing or unready fulfillment blocks product', () => {
  const r = adaptProduct(readyProduct(), { entries: {} });
  assert.equal(r.status, 'BLOCKED');
  assert.ok(r.reasons.includes('VERIFIED_ZERO_HUMAN_FULFILLMENT_NOT_READY'));
});

test('held, unapproved and adult-silo products never become eligible', () => {
  assert.equal(adaptProduct(readyProduct({ status: 'held' }), readyRegistry).status, 'BLOCKED');
  assert.equal(adaptProduct(readyProduct({ commercial_truth: { sellable: true, approval_required: true } }), readyRegistry).status, 'BLOCKED');
  assert.equal(adaptProduct(readyProduct({ silo: 'amplissa' }), readyRegistry).status, 'BLOCKED');
});

test('physical inventory, price units and source URL are validated', () => {
  assert.equal(priceMajor({ price: 40000, price_unit: 'minor' }), 400);
  assert.equal(productType({ inventory_type: 'physical', fulfillment: {} }), 'physical_goods');
  assert.equal(canonicalSourceUrl({ checkout: { url: '//attacker.example/path' } }), null);
  const physical = readyProduct({
    id: 'FIXTURE-PHYSICAL-001',
    inventory_type: 'physical',
    inventory: 0,
    fulfillment: { mode: 'physical_dispatch', operator_required: false }
  });
  assert.ok(adaptProduct(physical, { entries: { 'FIXTURE-PHYSICAL-001': { ready: true, operator_required: false } } }).reasons.includes('PHYSICAL_STOCK_NOT_PROVEN'));
});
