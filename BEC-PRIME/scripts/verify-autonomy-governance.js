'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const policy = require('../governance/GovernancePolicy.json');
const g = require('../governance/GovernedExecution');

test('default deny is enforced', () => {
  const r = g.evaluateTransition(policy, {
    transition_id: 't1', transition_name: 'OFFER_READY_TO_OFFER_PUBLISHED',
    entity_id: 'offer1', idempotency_key: 'idem1', schema_version: '1.0',
    requested_action: 'publish'
  }, { garage_status: 'READY_FOR_PROMOTION' });
  assert.equal(r.decision, 'REJECT');
  assert.ok(r.checks.some(x => x.id === 'authorization_record' && x.status === 'FAIL'));
});

test('garage cannot execute an external action during hold', () => {
  const garage = g.stageInGarage(policy, {
    transition_id: 't2', transition_name: 'PUBLISH', entity_id: 'offer2',
    idempotency_key: 'idem2', schema_version: '1.0', requested_action: 'publish'
  }, '2026-09-21T00:00:00.000Z');
  assert.equal(g.evaluateGaragePromotion(policy, garage, Date.parse('2026-09-21T23:59:59Z')).eligible, false);
  assert.equal(g.evaluateGaragePromotion(policy, garage, Date.parse('2026-09-22T00:00:00Z')).eligible, true);
});

test('kill switch wins', () => {
  const r = g.evaluateTransition(policy, {
    transition_id: 't3', transition_name: 'PUBLISH', entity_id: 'offer3',
    idempotency_key: 'idem3', schema_version: '1.0', requested_action: 'publish',
    evidence: { authorization_record: true, checkpoint_id: 'cp3' }
  }, { garage_status: 'READY_FOR_PROMOTION', kill_state: 'TRIPPED' });
  assert.equal(r.decision, 'REJECT');
  assert.ok(r.checks.some(x => x.id === 'kill_switch' && x.status === 'FAIL'));
});

test('authorization is independently default-deny', () => {
  const r = g.authorizeAction(policy, {
    action: 'publish', transition_id: 't4', capability: 'offer:publish',
    expires_at: '2026-09-22T00:00:00.000Z', blast_radius: { max_external_actions: 1 }
  });
  assert.equal(r.decision, 'ALLOW');
  const denied = g.authorizeAction(policy, { action: 'publish' });
  assert.equal(denied.decision, 'DENY');
});

test('canary rolls back on independent external anomaly', () => {
  const r = g.canaryDecision(policy, { unexpected_external_effects: 1 });
  assert.equal(r.decision, 'ROLLBACK');
});

test('circuit breaker trips on verification contradiction', () => {
  const r = g.circuitBreaker(policy, { verification_contradictions: 1 });
  assert.equal(r.trip, true);
  assert.ok(r.reasons.includes('verification_contradiction'));
});

test('provenance facts remain explicitly unverified until evidence says otherwise', () => {
  const fact = g.provenanceFact({ entity: 'offer1', relation: 'price', value: 50, source: 'catalog', evidence_status: 'UNVERIFIED' });
  assert.equal(fact.evidence_status, 'UNVERIFIED');
  assert.ok(fact.evidence_hash.startsWith(''));
});

console.log('AUTONOMY_GOVERNANCE_TESTS_READY');
