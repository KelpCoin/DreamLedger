'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../governance/GovernancePolicy.json');
const {
  evaluateTransition,
  stageInGarage,
  evaluateGaragePromotion,
  authorizeAction,
  circuitBreaker
} = require('../governance/GovernedExecution');

const transition = (overrides = {}) => ({
  transition_id: 'gov-test-1',
  transition_name: 'EXTERNAL_ACTION_TEST',
  entity_id: 'offer-test',
  idempotency_key: 'gov-test-idem-1',
  schema_version: '1.0',
  requested_action: 'purchase',
  blast_radius: { max_spend_nzd: 0, max_recipients: 1, max_external_actions: 1 },
  evidence: {},
  ...overrides
});

test('governance policy remains default-deny with no automatic promotion', () => {
  assert.equal(policy.default, 'DENY');
  assert.equal(policy.authorization.default, 'DENY');
  assert.equal(policy.canary.auto_promote, false);
  assert.equal(policy.garage.required_for_external_side_effects, true);
  assert.equal(policy.garage.minimum_hold_hours, 24);
  assert.equal(policy.learning.allow_unverified_experience_to_change_policy, false);
});

test('external side effect is rejected without explicit authorization and checkpoint', () => {
  const result = evaluateTransition(policy, transition(), { garage_status: 'READY_FOR_PROMOTION' });
  assert.equal(result.decision, 'REJECT');
  assert.ok(result.checks.some(x => x.id === 'authorization_record' && x.status === 'FAIL'));
  assert.ok(result.checks.some(x => x.id === 'checkpoint_id' && x.status === 'FAIL'));
});

test('garage promotion cannot happen before the hold expires', () => {
  const staged = stageInGarage(policy, transition(), '2026-10-11T00:00:00.000Z');
  assert.equal(staged.external_credentials_available, false);
  assert.equal(evaluateGaragePromotion(policy, staged, Date.parse('2026-10-11T23:59:59.000Z')).eligible, false);
  assert.equal(evaluateGaragePromotion(policy, staged, Date.parse('2026-10-12T00:00:00.000Z')).eligible, true);
});

test('authorization token fails closed when required authority fields are absent', () => {
  const result = authorizeAction(policy, 'purchase', {}, { kill_state: 'ARMED' });
  assert.equal(result.decision, 'DENY');
  assert.ok(result.failures.includes('missing_transition_id'));
  assert.ok(result.failures.includes('missing_expiry'));
  assert.ok(result.failures.includes('missing_capability'));
});

test('circuit breaker trips on contradictory verification or excess external actions', () => {
  assert.equal(circuitBreaker(policy, { verification_contradictions: 1 }).trip, true);
  assert.equal(circuitBreaker(policy, { external_actions: 2 }).trip, true);
  assert.equal(circuitBreaker(policy, {}).trip, false);
});
