'use strict';

const assert = require('node:assert');
const test = require('node:test');
const { allocate, recordOutcome, CONDITION_FIELDS } = require('./CubeExperimentAllocator');

test('allocator is deterministic and ranks information value per compute', () => {
  const candidates = [
    { mechanism_id: 'B', prior_information_value: 4, novelty: 1, transferability: 1, estimated_compute_cost: 2, risk_penalty: 0 },
    { mechanism_id: 'A', prior_information_value: 5, novelty: 1, transferability: 1, estimated_compute_cost: 2, risk_penalty: 0 }
  ];
  const a = allocate(candidates, { SEARCH_DEPTH: 3 }, 10);
  const b = allocate(candidates, { SEARCH_DEPTH: 3 }, 10);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.candidates[0].mechanism_id, 'A');
  assert.strictEqual(a.candidates[0].rank, 1);
});

test('condition vector is fixed schema, not post-hoc selected fields', () => {
  const result = allocate(
    [{ mechanism_id: 'M1', prior_information_value: 1, novelty: 1, transferability: 1, estimated_compute_cost: 1, risk_penalty: 0 }],
    { SEARCH_DEPTH: 5, made_up_field: 99 },
    5
  );
  assert.deepStrictEqual(Object.keys(result.condition_vector), CONDITION_FIELDS);
  assert.strictEqual(result.condition_vector.SEARCH_DEPTH, 5);
  assert.strictEqual(result.condition_vector.made_up_field, undefined);
});

test('over-budget candidate is deferred', () => {
  const result = allocate(
    [{ mechanism_id: 'EXPENSIVE', prior_information_value: 9, novelty: 9, transferability: 9, estimated_compute_cost: 100, risk_penalty: 0 }],
    {},
    5
  );
  assert.strictEqual(result.candidates[0].allocation_status, 'DEFERRED');
});

test('allocator accuracy record is immutable and explicit', () => {
  const allocation = allocate(
    [{ mechanism_id: 'M1', prior_information_value: 4, novelty: 2, transferability: 0, estimated_compute_cost: 2, risk_penalty: 0 }],
    {},
    10
  ).candidates[0];
  const outcome = recordOutcome(allocation, 2, 2, 'LOW_INFORMATION');
  assert.strictEqual(outcome.prediction_error, 2);
  assert.strictEqual(outcome.allocation_outcome, 'LOW_INFORMATION');
});
