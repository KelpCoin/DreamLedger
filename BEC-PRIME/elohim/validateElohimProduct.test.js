'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCatalogProduct,
  validateElohimCandidate,
  candidateToDraftProduct,
  assertValidProduct
} = require('./validateElohimProduct');
const { createCandidate } = require('../council/ElohimCreate');

test('valid catalog product passes', () => {
  const r = validateCatalogProduct({
    id: 'DOC-EXTRACT-50',
    name: 'Document Extraction',
    price: 5,
    price_unit: 'major',
    currency: 'nzd',
    status: 'draft',
    silo: 'digital_products',
    checkout_available: false
  });
  assert.equal(r.ok, true);
  assert.equal(r.price_major_nzd, 5);
});

test('checkout_available without Stripe URL fails', () => {
  const r = validateCatalogProduct({
    id: 'BAD-CHECKOUT',
    name: 'Bad',
    price: 10,
    currency: 'nzd',
    status: 'published',
    silo: 'digital_products',
    checkout_available: true,
    checkout_url: null
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.code === 'CHECKOUT_URL' || e.code === 'PUBLISH_CHECKOUT'));
});

test('price below floor fails', () => {
  const r = validateCatalogProduct({
    id: 'CHEAP',
    name: 'Too cheap',
    price: 1,
    currency: 'nzd',
    status: 'draft',
    silo: 'mtg'
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.code === 'PRICE_FLOOR'));
});

test('invalid silo fails', () => {
  const r = validateCatalogProduct({
    id: 'SILO-X',
    name: 'X',
    price: 10,
    currency: 'nzd',
    status: 'draft',
    silo: 'womens-clothing'
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.code === 'SILO' || e.code === 'SCHEMA'));
});

test('ElohimCreate emits validated candidate in allowed silo', () => {
  const c = createCandidate({
    id: 'CAP-TEST',
    name: 'Test capability',
    silo: 'mtg',
    price: 29
  });
  assert.equal(c.validation.ok, true);
  assert.equal(c.silo, 'mtg');
  assert.equal(c.checkout_available, false);
  assert.equal(c.created_by, 'ELOHIM');
});

test('missing Elohim price is held instead of receiving an invented NZ$49 default', () => {
  const c = createCandidate({
    id: 'CAP-HOST',
    name: 'Host product',
    silo: 'dreamledger'
  });
  assert.equal(c.silo, 'digital_products');
  assert.equal(c.status, 'UNPRICED_HELD');
  assert.equal(c.price_status, 'HELD_MISSING_PRICE_EVIDENCE');
  assert.deepEqual(c.price_proposal_nzd, []);
  assert.equal(c.checkout_available, false);
  assert.equal(c.validation.ok, false);
  assert.ok(c.validation.errors.some(e => e.code === 'PRICE_EVIDENCE_REQUIRED'));
});

test('candidateToDraftProduct produces draft catalog product', () => {
  const c = createCandidate({
    id: 'CAP-DRAFT',
    name: 'Draft me',
    silo: 'digital_products',
    price: 19
  });
  const p = candidateToDraftProduct(c);
  assert.equal(p.status, 'draft');
  assert.equal(p.checkout_available, false);
  assert.equal(p.currency, 'nzd');
  assertValidProduct(p);
});

test('Elohim candidate with checkout_available true is rejected', () => {
  const r = validateElohimCandidate({
    id: 'ELOHIM-CANDIDATE-TEST',
    schema_version: 'BEC-ELOHIM-CREATED-CANDIDATE-1.0',
    status: 'ELOHIM_CREATED_CANDIDATE',
    silo: 'mtg',
    name: 'Nope',
    price_proposal_nzd: [29],
    checkout_available: true,
    approval_required: true,
    created_by: 'ELOHIM'
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.code === 'CHECKOUT_GATE'));
});
