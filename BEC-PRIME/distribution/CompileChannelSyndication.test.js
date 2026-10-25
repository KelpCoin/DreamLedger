'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compile, compileMany, validateProduct } = require('./CompileChannelSyndication');

const base = {
  product_id: 'TEST-DIGITAL-001',
  silo_id: 'digital_goods',
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

test('dedupe keys are stable across timestamps but change when content changes', () => {
  const a = compile(base, undefined, '2026-10-26T00:00:00.000Z');
  const b = compile(base, undefined, '2026-10-27T00:00:00.000Z');
  assert.deepEqual(a.channels.map(c => c.dedupe_key), b.channels.map(c => c.dedupe_key));
  const changed = compile({ ...base, title: 'Changed title' }, undefined, '2026-10-27T00:00:00.000Z');
  assert.notDeepEqual(a.channels.map(c => c.dedupe_key), changed.channels.map(c => c.dedupe_key));
});

test('batch fan-out handles multiple products in one run and rejects duplicate IDs', () => {
  const second = { ...base, product_id: 'TEST-DIGITAL-002', title: 'Second synthetic sample' };
  const r = compileMany([base, second], undefined, '2026-10-26T00:00:00.000Z');
  assert.equal(r.counts.products_considered, 2);
  assert.equal(r.counts.published, 0);
  assert.equal(r.products.length, 2);
  assert.throws(() => compileMany([base, base]), /DUPLICATE_PRODUCT_ID/);
});

test('adult silo is blocked and channel routing uses per-channel allowlists', () => {
  assert.throws(() => validateProduct({ ...base, silo_id: 'amplissa' }), /BLOCKED_SILO_ID/);
  const mtg = { ...base, silo_id: 'mtg', product_type: 'physical_goods', inventory_count: 1 };
  const r = compile(mtg, undefined, '2026-10-26T00:00:00.000Z');
  assert.ok(r.channels.some(c => c.channel_id === 'trademe' && c.status === 'STAGED_DRAFT'));
  assert.ok(r.channels.filter(c => c.channel_id === 'patreon_shop').every(c => c.status === 'SKIPPED_INCOMPATIBLE' || c.status === 'SKIPPED_INCOMPATIBLE'));
});

test('output is explicitly non-publishing and non-financial', () => {
  const r = compile(base, undefined, '2026-10-26T00:00:00.000Z');
  assert.equal(r.policy.money_movement_allowed, false);
  assert.equal(r.policy.public_action_allowed, false);
});
