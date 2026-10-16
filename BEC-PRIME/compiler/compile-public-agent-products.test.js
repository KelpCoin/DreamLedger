'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { compile, validateCatalog } = require('./compile-public-agent-products');

const root = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(root, 'BEC-PRIME', 'catalog', 'public-agent-products.source.json');

test('canonical registry compiles byte-for-byte to the public product feed', () => {
  const result = compile({ write: false });
  const checkedIn = fs.readFileSync(path.join(root, 'public', 'agent-products.json'), 'utf8');
  assert.equal(result.output, checkedIn);
  assert.equal(result.items.find(x => x.item_id === 'TRUTH-ORACLE-ACCESS-001').enable_checkout, false);
  assert.equal(result.items.find(x => x.item_id === 'TRUTH-ORACLE-ACCESS-001').availability, 'review_required');
  const commander = result.items.find(x => x.item_id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.equal(commander.enable_checkout, false);
  assert.equal(commander.availability, 'review_required');
  assert.equal(Object.hasOwn(commander, 'buy_router'), false);
});

test('retired standalone audit listing cannot be reintroduced', () => {
  const items = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  items.push({ ...items[0], item_id: 'AGENT-PROOF-AUDIT-49', sku: 'AGENT-PROOF-AUDIT-49' });
  assert.throws(() => validateCatalog(items), /Retired standalone audit listing/);
});

test('Truth Oracle Access checkout cannot be turned on by catalog edits', () => {
  const items = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  items.find(x => x.item_id === 'TRUTH-ORACLE-ACCESS-001').enable_checkout = true;
  assert.throws(() => validateCatalog(items), /checkout must remain disabled/);
});

test('Commander diagnostic cannot be re-enabled without canonical fulfillment proof', () => {
  const items = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const commander = items.find(x => x.item_id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  commander.enable_checkout = true;
  assert.throws(() => validateCatalog(items), /Commander diagnostic checkout must remain disabled/);
});

test('duplicate IDs or SKUs fail closed', () => {
  const items = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  items.push({ ...items[0] });
  assert.throws(() => validateCatalog(items), /Duplicate item_id/);
});

test('compiler records no economic truth or external action authority', () => {
  const result = compile({ write: false });
  assert.equal(result.proof.economic_truth_effect, 'NONE');
  assert.equal(result.proof.external_action, 'NONE');
});
