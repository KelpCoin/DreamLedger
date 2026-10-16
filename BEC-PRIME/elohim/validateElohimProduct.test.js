'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

test('legacy catalog-only silo remains provenance-only and non-publishable', () => {
  const r = validateCatalogProduct({
    id: 'BILLBOARD-LARGE',
    name: 'Legacy billboard listing',
    price: 349,
    price_unit: 'major',
    currency: 'nzd',
    status: 'catalog_only',
    silo: 'billboard',
    inventory: 0,
    checkout_available: false,
    checkout: { mode: 'disabled', url: null },
    commercial_truth: { approval_required: true, sellable: false }
  });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some(w => w.code === 'LEGACY_SILO_NON_PUBLISHABLE'));
  assert.equal(validateElohimCandidate({
    id: 'NEW-LEGACY-SILO',
    name: 'Must not create in legacy silo',
    silo: 'billboard',
    price_proposal_nzd: [29],
    approval_required: true,
    checkout_available: false,
    created_by: 'ELOHIM'
  }).ok, false);
});

test('archived catalog records remain valid without becoming sellable', () => {
  const r = validateCatalogProduct({
    id: 'ARCHIVED-TEST',
    name: 'Archived record',
    price: 49,
    currency: 'nzd',
    status: 'archived',
    silo: 'commerce',
    checkout_available: false,
    checkout: { mode: 'disabled', url: null },
    commercial_truth: { approval_required: true, sellable: false }
  });
  assert.equal(r.ok, true);
  assert.equal(r.silo, null);
  assert.ok(r.warnings.some(w => w.code === 'LEGACY_SILO_NON_PUBLISHABLE'));
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

test('dreamledger host silo maps to digital_products', () => {
  const c = createCandidate({
    id: 'CAP-HOST',
    name: 'Host product',
    silo: 'dreamledger'
  });
  assert.equal(c.silo, 'digital_products');
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

test('uses the declared JSON Schema 2020-12 dialect and rejects wrong field types', () => {
  const productSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'elohim-product.schema.json'), 'utf8'));
  const candidateSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'elohim-candidate.schema.json'), 'utf8'));
  assert.equal(productSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(candidateSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  const result = validateCatalogProduct({
    id: 'SCHEMA-DIALECT-TEST',
    name: 'Schema dialect test',
    price: 29,
    price_unit: 'major',
    currency: 'nzd',
    status: 'draft',
    silo: 'mtg',
    checkout_available: 'false'
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'SCHEMA' && error.path === '/checkout_available'));
});
