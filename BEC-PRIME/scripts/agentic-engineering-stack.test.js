'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('five-layer contract keeps model, harness, loop, graph and factory duties distinct', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/agentic-engineering-stack.json'), 'utf8'));
  assert.deepEqual(Object.keys(contract.layers), ['model', 'harness', 'loop', 'graph', 'factory']);
  assert.equal(contract.layers.model.may_certify_its_own_output, false);
  assert.equal(contract.layers.graph.independent_evaluator_required, true);
  assert.equal(contract.layers.loop.repeated_failure_action, 'QUARANTINE_AND_ESCALATE');
  assert.equal(contract.layers.factory.preserve_silo_isolation, true);
});
