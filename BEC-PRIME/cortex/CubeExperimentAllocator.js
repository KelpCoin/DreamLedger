'use strict';

/*
 * CUBE Experiment Allocator v1
 *
 * Deterministic allocation only. LLMs may propose candidates, but this module
 * decides ordering from sealed facts. It does not claim demand, revenue, or PMF.
 */

const CONDITION_SCHEMA_VERSION = 'CUBE-CONDITIONS-1';
const MECHANISM_SCHEMA_VERSION = 'CUBE-MECHANISM-1';

const CONDITION_FIELDS = Object.freeze([
  'SEARCH_DEPTH',
  'RESULT_COUNT',
  'RANKING_POLICY',
  'RESPONSE_ORDER',
  'CONTACT_BUDGET',
  'COMPARISON_COUNT',
  'INFORMATION_VISIBILITY'
]);

function requiredString(value, field) {
  const v = String(value == null ? '' : value).trim();
  if (!v) throw new Error(field + ' is required');
  return v;
}

function finiteNonNegative(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(field + ' must be finite and >= 0');
  return n;
}

function conditionVector(input) {
  const source = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const field of CONDITION_FIELDS) out[field] = source[field] == null ? null : source[field];
  return Object.freeze(out);
}

function scoreCandidate(candidate, context) {
  const c = candidate || {};
  const prior = finiteNonNegative(c.prior_information_value, 'prior_information_value');
  const novelty = finiteNonNegative(c.novelty, 'novelty');
  const transfer = finiteNonNegative(c.transferability, 'transferability');
  const cost = finiteNonNegative(c.estimated_compute_cost, 'estimated_compute_cost');
  const risk = finiteNonNegative(c.risk_penalty, 'risk_penalty');
  const budget = Math.max(1, finiteNonNegative(context.available_compute, 'available_compute'));

  // Information value per unit compute, with explicit bounded priors.
  const raw = prior + novelty + transfer;
  return Math.max(0, raw - risk) / Math.max(1, cost) * budget;
}

function allocate(mechanismLibrary, currentConditions, availableCompute) {
  const context = {
    available_compute: finiteNonNegative(availableCompute, 'available_compute'),
    condition_schema_version: CONDITION_SCHEMA_VERSION,
    condition_vector: conditionVector(currentConditions)
  };

  if (!Array.isArray(mechanismLibrary)) throw new Error('mechanismLibrary must be an array');

  const ranked = mechanismLibrary
    .map((candidate, index) => {
      const mechanismId = requiredString(candidate.mechanism_id, 'mechanism_id');
      const score = scoreCandidate(candidate, context);
      const cost = finiteNonNegative(candidate.estimated_compute_cost, 'estimated_compute_cost');
      return {
        allocation_id: 'ALLOC-' + String(index + 1).padStart(4, '0'),
        mechanism_id: mechanismId,
        predicted_information_value: score,
        compute_allocated: Math.min(cost, context.available_compute),
        estimated_compute_cost: cost,
        condition_schema_version: CONDITION_SCHEMA_VERSION,
        condition_vector: context.condition_vector,
        allocation_status: cost <= context.available_compute ? 'ELIGIBLE' : 'DEFERRED',
        rank_key: score
      };
    })
    .sort((a, b) => b.rank_key - a.rank_key || a.mechanism_id.localeCompare(b.mechanism_id))
    .map(({ rank_key, ...row }, rank) => ({ ...row, rank: rank + 1 }));

  return Object.freeze({
    schema_version: MECHANISM_SCHEMA_VERSION,
    allocator: 'CUBE_DETERMINISTIC_ALLOCATOR_V1',
    available_compute: context.available_compute,
    condition_schema_version: context.condition_schema_version,
    condition_vector: context.condition_vector,
    candidates: Object.freeze(ranked)
  });
}

function recordOutcome(allocation, actualInformationValue, computeConsumed, outcome) {
  if (!allocation || typeof allocation !== 'object') throw new Error('allocation is required');
  return Object.freeze({
    allocation_id: requiredString(allocation.allocation_id, 'allocation_id'),
    mechanism_id: requiredString(allocation.mechanism_id, 'mechanism_id'),
    predicted_information_value: finiteNonNegative(allocation.predicted_information_value, 'predicted_information_value'),
    actual_information_value: finiteNonNegative(actualInformationValue, 'actual_information_value'),
    prediction_error: finiteNonNegative(
      Math.abs(Number(actualInformationValue) - Number(allocation.predicted_information_value)),
      'prediction_error'
    ),
    compute_allocated: finiteNonNegative(allocation.compute_allocated, 'compute_allocated'),
    compute_consumed: finiteNonNegative(computeConsumed, 'compute_consumed'),
    allocation_outcome: requiredString(outcome, 'allocation_outcome')
  });
}

module.exports = {
  CONDITION_FIELDS,
  CONDITION_SCHEMA_VERSION,
  MECHANISM_SCHEMA_VERSION,
  allocate,
  conditionVector,
  recordOutcome
};
