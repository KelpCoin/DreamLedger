'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'config/agentic-engineering-stack.json'), 'utf8'));
assert.equal(contract.schema_version, 'dreamledger/agentic-engineering-stack/v1');

const layers = contract.layers;
for (const layer of ['model', 'harness', 'loop', 'graph', 'factory']) {
  assert.ok(layers[layer], 'Missing layer: ' + layer);
  assert.ok(layers[layer].owns, 'Layer has no owned decision: ' + layer);
}
assert.equal(layers.model.may_certify_its_own_output, false);
assert.equal(layers.harness.least_privilege_required, true);
assert.equal(layers.harness.external_actions_enabled_by_default, false);
assert.equal(layers.loop.deterministic_stop_conditions_required, true);
assert.ok(Number.isInteger(layers.loop.max_attempts_per_task) && layers.loop.max_attempts_per_task >= 1 && layers.loop.max_attempts_per_task <= 3);
assert.equal(layers.loop.unverified_success_claims_forbidden, true);
assert.equal(layers.graph.independent_evaluator_required, true);
assert.equal(layers.graph.builder_and_evaluator_must_be_logically_separate, true);
assert.equal(layers.graph.fail_closed_on_missing_evidence, true);
assert.equal(layers.factory.clone_from_canonical_contracts_only, true);
assert.equal(layers.factory.clone_customer_data_or_credentials, false);
assert.equal(layers.factory.preserve_silo_isolation, true);
for (const value of Object.values(contract.mandatory_gates)) assert.equal(value, true);
console.log(JSON.stringify({ status: 'PASS', contract_id: contract.contract_id, layers: 5, verified: true }, null, 2));
