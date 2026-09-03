'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const pipeline = require('../runtime/RevenuePipeline');
const bandit = require('../runtime/RevenueBandit');

test('pipeline is deterministic and proposal-only', () => {
  const input = {
    signal: { signal_id: 'sig_001', source: 'reddit', intent: 'purchase' },
    routes: [{ id: 'route_1', source: 'reddit', intent: 'purchase', enabled: true }],
    proposal: { sku: 'SKU_001', price: 29, currency: 'NZD' },
    gauntlet: { status: 'PASS' },
    metrics: { observations: 1 }
  };
  const a = pipeline.run(input);
  const b = pipeline.run(input);
  assert.equal(a.status, 'PASS');
  assert.equal(a.pipeline_hash, b.pipeline_hash);
  assert.equal(a.stages[2].execution_allowed, false);
  assert.equal(a.stages[5].status, 'STAGED');
});

test('failed validation quarantines output', () => {
  const result = pipeline.run({
    signal: { signal_id: 'sig_002', source: 'github' },
    routes: [{ id: 'route_2', source: 'github', enabled: true }],
    proposal: { sku: 'SKU_002' },
    gauntlet: { status: 'FAIL' }
  });
  assert.equal(result.status, 'QUARANTINE');
  assert.equal(result.stages[5].status, 'QUARANTINED');
});

test('UCB1 explores unpulled arms', () => {
  const chosen = bandit.choose([
    { id: 'winner', pulls: 20, reward: 10 },
    { id: 'new', pulls: 0, reward: 0 }
  ]);
  assert.equal(chosen.id, 'new');
});

test('bandit updates and prunes only sufficiently observed weak arms', () => {
  const arm = bandit.update({ id: 'a', pulls: 2, reward: 0 }, 1);
  assert.deepEqual(arm, { id: 'a', pulls: 3, reward: 1 });
  const kept = bandit.prune([
    { id: 'new', pulls: 2, reward: 0 },
    { id: 'weak', pulls: 10, reward: 0 },
    { id: 'winner', pulls: 10, reward: 1 }
  ]);
  assert.deepEqual(kept.map(x => x.id), ['new', 'winner']);
});
