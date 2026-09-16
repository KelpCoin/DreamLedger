'use strict';

const assert = require('assert');
const FactoryFactory = require('./FactoryFactory');

const blueprint = {
  id: 'test-factory',
  name: 'Test Factory',
  purpose: 'Execute a bounded test job',
  autonomy_ceiling: 'L2',
  risk_class: 'LOW',
  action_budget: 5,
  kill_switch: 'GLOBAL_FACTORY_KILL_SWITCH'
};

const instance = FactoryFactory.instantiate(blueprint, { name: 'Test Factory #1', autonomy_level: 'L1' });
assert.strictEqual(instance.status, 'PLACED');
assert.strictEqual(instance.blueprint_id, 'test-factory');

const run = FactoryFactory.startRun(instance, 'verify factory contract', { source: 'deterministic-test' });
assert.strictEqual(run.status, 'STARTED');

const outcome = FactoryFactory.recordOutcome(run, {
  status: 'SUCCESS',
  expected: 'factory contract accepted',
  observed: 'factory contract accepted',
  evidence_refs: ['test://factory-contract']
});
assert.strictEqual(outcome.status, 'SUCCESS');

const positive = FactoryFactory.signal(run, 'POSITIVE', { reason: 'deterministic contract test passed' });
assert.strictEqual(positive.type, 'POSITIVE');

const rejection = FactoryFactory.rejection(run, 'human rejected test placement', ['test://rejection']);
assert.strictEqual(rejection.reason, 'human rejected test placement');

assert.throws(() => FactoryFactory.recordOutcome(run, { status: 'SUCCESS' }), /SUCCESS_REQUIRES_EVIDENCE/);
assert.throws(() => FactoryFactory.instantiate({ ...blueprint, autonomy_ceiling: 'L1' }, { autonomy_level: 'L2' }), /AUTONOMY_EXCEEDS_BLUEPRINT_CEILING/);
assert.throws(() => FactoryFactory.signal(run, 'UNKNOWN', {}), /INVALID_SIGNAL_TYPE/);

console.log(JSON.stringify({ status: 'PASS', test: 'factory-factory-v1' }));
