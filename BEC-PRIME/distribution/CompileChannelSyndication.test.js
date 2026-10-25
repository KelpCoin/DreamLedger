'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compile, validateProduct } = require('./CompileChannelSyndication');

const base = {
  product_id: 'TEST-DIGITAL-001',
  silo_id: 'SILO_DREAMLEDGER',
  title: 'Synthetic sample report',
  description: 'Synthetic fixture only; not a real offer.',
  product_type: 'digital_diagnostic',
  price: 'NZD 0 (TEST FIXTURE ONLY)',
  source_url: 'https://example.invalid/fixture',
  delivery_spec: 'Synthetic report fixture',
  inventory_count: null
};

test('fan-out stages all compatible channel drafts and publishes none', () => {
  const r = compile(base, undefined, '2026-10-26T00:00:00.000Z');
  assert.equal(r.truth_label, 'DRAFT_ONLY_NOT_PUBLISHED_NOT_REVENUE');
  assert.equal(r.counts.channels_considered, 7);
  assert.equal(r.counts.published, 0);
  assert.ok(r.channels.some(c => c.channel_id === 'patreon_shop' && c.status === 'STAGED_DRAFT'));
  assert.ok(r.channels.some(c => c.channel_id === 'trademe' && c.status === 'SKIPPED_INCOMPATIBLE'));
  assert.ok(r.channels.filter(c => c.compatible).every(c => c.payload.public_action_allowed === false));
});

test('physical goods require explicit positive inventory', () => {
  assert.throws(() => validateProduct({ ...base, product_type: 'physical_goods', inventory_count: 0 }), /PHYSICAL_STOCK_PROOF_REQUIRED/);
  assert.doesNotThrow(() => validateProduct({ ...base, product_type: 'physical_goods', inventory_count: 1 }));
});

test('missing source and invalid types fail closed', () => {
  assert.throws(() => validateProduct({ ...base, source_url: '' }), /REQUIRED_FIELD:source_url/);
  assert.throws(() => validateProduct({ ...base, product_type: 'whatever' }), /INVALID_PRODUCT_TYPE/);
});

test('cross-silo contamination is rejected', () => {
  assert.throws(() => validateProduct({ ...base, description: 'Amplissa adult-only sample' }), /CROSS_SILO_CONTENT_BLOCKED/);
});

test('dedupe keys are deterministic for identical inputs', () => {
  const a = compile(base, undefined, '2026-10-26T00:00:00.000Z');
  const b = compile(base, undefined, '2026-10-26T00:00:00.000Z');
  assert.deepEqual(a.channels.map(c => c.dedupe_key), b.channels.map(c => c.dedupe_key));
});

test('output path is not part of compiler; caller must opt into a new file', () => {
  assert.equal(compile(base, undefined, '2026-10-26T00:00:00.000Z').policy.money_movement_allowed, false);
});
