'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ECONOMIC_STEPS,
  CLONE_DIMENSIONS,
  VERIFIER_BY_SIGNAL,
  evaluateEconomicEvent,
  evaluateCloneIsolation,
  evaluateTrajectory,
  calculateGracefulDegradation
} = require('./ContinuousCompletionEvaluator');

const HASH = 'a'.repeat(64);
const VERIFIED_AT = '2026-10-16T08:00:00.000Z';

function evaluate(input) {
  return evaluateEconomicEvent(input, { verifyEvidence: () => true });
}

function evaluateClone(input) {
  return evaluateCloneIsolation(input, { verifyEvidence: () => true });
}

function signalRecord(signal, status = 'PASS') {
  return {
    status,
    evidence_ref: 'proof://' + signal,
    evidence_sha256: HASH,
    verified_by: VERIFIER_BY_SIGNAL[signal]
  };
}

function allPassSignals() {
  const result = {};
  for (const step of ECONOMIC_STEPS) {
    for (const signal of step.signals) result[signal] = signalRecord(signal);
  }
  return result;
}

function finalOutcome() {
  return {
    status: 'PASS',
    evidence_ref: 'proof://independent-economic-outcome',
    evidence_sha256: HASH,
    verified_by: 'economic-outcome-verifier',
    verified: true,
    proof_ref: 'proof://ra-000001',
    settlement_reconciled: true,
    reversals_checked: true
  };
}

function cloneDimensionRecord(dimension, status = 'PASS') {
  return {
    status,
    evidence_ref: 'proof://clone/' + dimension,
    evidence_sha256: HASH,
    verified_by: 'clone-isolation-verifier'
  };
}

function allPassCloneDimensions() {
  const result = {};
  for (const dimension of CLONE_DIMENSIONS) result[dimension.id] = cloneDimensionRecord(dimension.id);
  return result;
}

function cloneApproval() {
  return {
    status: 'PASS',
    evidence_ref: 'proof://clone/release-approval',
    evidence_sha256: HASH,
    verified_by: 'clone-release-verifier',
    approved: true
  };
}

test('the ten economic weights sum to exactly 1 and steps one through six total 0.60', () => {
  const total = ECONOMIC_STEPS.reduce((sum, step) => sum + step.weight, 0);
  const firstSix = ECONOMIC_STEPS.slice(0, 6).reduce((sum, step) => sum + step.weight, 0);
  assert.equal(Number(total.toFixed(8)), 1);
  assert.equal(Number(firstSix.toFixed(8)), 0.6);
});

test('missing evidence scores zero and is never silently credited', () => {
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: {}
  });
  assert.equal(verdict.completion_score, 0);
  assert.equal(verdict.typed_verdict, 'NEEDS_EVIDENCE');
  assert.equal(verdict.binary_gate_pass, false);
  assert.equal(verdict.verified_economic_outcome, false);
  assert.equal(verdict.missing_evidence.length, 31);
});

test('verified steps one through six score 0.60 while attribution remains missing', () => {
  const signals = {};
  for (const step of ECONOMIC_STEPS.slice(0, 6)) {
    for (const signal of step.signals) signals[signal] = signalRecord(signal);
  }
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: signals
  });
  assert.equal(verdict.completion_score, 0.6);
  assert.equal(verdict.typed_verdict, 'NEEDS_EVIDENCE');
  assert.equal(verdict.step_breakdown.attributed_transaction.score, 0);
  assert.equal(verdict.binary_gate_pass, false);
  assert.ok(verdict.missing_evidence.includes('order_id_resolved'));
});

test('a 1.00 completion score does not pass the economic gate without independent final-outcome proof', () => {
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: allPassSignals()
  });
  assert.equal(verdict.completion_score, 1);
  assert.equal(verdict.typed_verdict, 'NEEDS_EVIDENCE');
  assert.equal(verdict.binary_gate_pass, false);
  assert.equal(verdict.verified_economic_outcome, false);
  assert.ok(verdict.missing_evidence.includes('final_outcome_independent_verification'));
});

test('PASS claims without a trusted evidence verifier are quarantined', () => {
  const verdict = evaluateEconomicEvent({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: allPassSignals(),
    finalOutcome: finalOutcome()
  });
  assert.equal(verdict.typed_verdict, 'QUARANTINE');
  assert.equal(verdict.completion_score, 0);
  assert.equal(verdict.binary_gate_pass, false);
  assert.ok(verdict.invalid_evidence.some(value => value.includes('TRUSTED_EVIDENCE_VERIFIER_UNAVAILABLE')));
});

test('all ten steps and independently verified final outcome are required for PROCEED', () => {
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: allPassSignals(),
    finalOutcome: finalOutcome()
  });
  assert.equal(verdict.completion_score, 1);
  assert.equal(verdict.typed_verdict, 'PROCEED');
  assert.equal(verdict.binary_gate_pass, true);
  assert.equal(verdict.verified_economic_outcome, true);
});

test('evidence-backed failed signal returns REPAIR with exact failed key', () => {
  const signals = allPassSignals();
  signals.order_id_resolved = signalRecord('order_id_resolved', 'FAIL');
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: signals,
    finalOutcome: finalOutcome()
  });
  assert.equal(verdict.typed_verdict, 'REPAIR');
  assert.equal(verdict.binary_gate_pass, false);
  assert.ok(verdict.failed_evidence.includes('order_id_resolved'));
  assert.ok(verdict.reason_codes.includes('EVIDENCE_CHECK_FAILED:order_id_resolved'));
});

test('invalid provenance or wrong verifier quarantines the candidate', () => {
  const signals = allPassSignals();
  signals.processor_settlement_verified = {
    status: 'PASS',
    evidence_ref: 'proof://settlement',
    evidence_sha256: HASH,
    verified_by: 'candidate-self-report'
  };
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: signals,
    finalOutcome: finalOutcome()
  });
  assert.equal(verdict.typed_verdict, 'QUARANTINE');
  assert.equal(verdict.binary_gate_pass, false);
  assert.ok(verdict.invalid_evidence.some(value => value.startsWith('processor_settlement_verified:')));
});

test('integrity conflict takes priority over ordinary progress', () => {
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: allPassSignals(),
    integrityConflicts: ['payment_id_sku_mismatch']
  });
  assert.equal(verdict.typed_verdict, 'QUARANTINE');
  assert.equal(verdict.binary_gate_pass, false);
});

test('fatal defect returns KILL and records the supplied defect', () => {
  const verdict = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: {},
    fatalDefects: ['deliverable_rights_unlawful']
  });
  assert.equal(verdict.typed_verdict, 'KILL');
  assert.ok(verdict.reason_codes.includes('FATAL:deliverable_rights_unlawful'));
});

test('unknown keys and non-boolean evidence statuses fail closed', () => {
  const extra = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: { source_url_verified: true, fabricated_green_flag: true }
  });
  assert.equal(extra.typed_verdict, 'QUARANTINE');
  assert.ok(extra.reason_codes[0].startsWith('UNKNOWN_SIGNAL:'));

  const nonBooleanStatus = evaluate({
    candidateId: 'RA_000001',
    verifiedAt: VERIFIED_AT,
    signalResults: { source_url_verified: { status: 'PASS', evidence_ref: 'proof://x', evidence_sha256: HASH, verified_by: 'source-provenance-verifier' } }
  });
  assert.equal(nonBooleanStatus.typed_verdict, 'NEEDS_EVIDENCE');
  assert.equal(nonBooleanStatus.completion_score, 0);
});

test('four of five clone dimensions score 0.85 but are not release-ready', () => {
  const dimensions = allPassCloneDimensions();
  dimensions.checkout_disabled_by_default = cloneDimensionRecord('checkout_disabled_by_default', 'FAIL');
  const verdict = evaluateClone({
    cloneId: 'clone-mtg-002',
    verifiedAt: VERIFIED_AT,
    dimensionResults: dimensions
  });
  assert.equal(verdict.completion_score, 0.85);
  assert.equal(verdict.typed_verdict, 'REPAIR');
  assert.equal(verdict.binary_gate_pass, false);
  assert.equal(verdict.release_ready, false);
  assert.ok(verdict.failed_evidence.includes('checkout_disabled_by_default'));
});

test('all five clone dimensions require independent release approval before release_ready', () => {
  const withoutApproval = evaluateClone({
    cloneId: 'clone-mtg-003',
    verifiedAt: VERIFIED_AT,
    dimensionResults: allPassCloneDimensions()
  });
  assert.equal(withoutApproval.completion_score, 1);
  assert.equal(withoutApproval.binary_gate_pass, true);
  assert.equal(withoutApproval.release_ready, false);
  assert.equal(withoutApproval.typed_verdict, 'NEEDS_EVIDENCE');

  const withApproval = evaluateClone({
    cloneId: 'clone-mtg-003',
    verifiedAt: VERIFIED_AT,
    dimensionResults: allPassCloneDimensions(),
    releaseApproval: cloneApproval()
  });
  assert.equal(withApproval.release_ready, true);
  assert.equal(withApproval.typed_verdict, 'PROCEED');
});

test('missing clone observations do not receive partial credit and request evidence', () => {
  const verdict = evaluateClone({
    cloneId: 'clone-mtg-004',
    verifiedAt: VERIFIED_AT,
    dimensionResults: {
      route_isolation: cloneDimensionRecord('route_isolation'),
      empty_catalogue_preservation: cloneDimensionRecord('empty_catalogue_preservation')
    }
  });
  assert.equal(verdict.completion_score, 0.45);
  assert.equal(verdict.typed_verdict, 'NEEDS_EVIDENCE');
  assert.equal(verdict.release_ready, false);
  assert.deepEqual(verdict.missing_evidence, ['checkout_disabled_by_default', 'credential_separation', 'gauntlet_enforcement']);
});

test('trajectory shows rollback and stagnation instead of hiding them', () => {
  const result = evaluateTrajectory([
    { candidate_id: 'RA_000001', completion_score: 0.2, verified_at: '2026-10-16T07:00:00.000Z', binary_gate_pass: false },
    { candidate_id: 'RA_000001', completion_score: 0.6, verified_at: '2026-10-16T07:01:00.000Z', binary_gate_pass: false },
    { candidate_id: 'RA_000001', completion_score: 0.6, verified_at: '2026-10-16T07:02:00.000Z', binary_gate_pass: false },
    { candidate_id: 'RA_000001', completion_score: 0.4, verified_at: '2026-10-16T07:03:00.000Z', binary_gate_pass: false }
  ]);
  assert.equal(result.status, 'PASS');
  assert.equal(result.observations, 4);
  assert.equal(result.regression_count, 1);
  assert.equal(result.repeated_score_count, 1);
  assert.equal(result.deltas[2].delta, -0.2);
});

test('duplicate trajectory observations are rejected', () => {
  const result = evaluateTrajectory([
    { candidate_id: 'RA_000001', completion_score: 0.2, verified_at: VERIFIED_AT },
    { candidate_id: 'RA_000001', completion_score: 0.3, verified_at: VERIFIED_AT }
  ]);
  assert.equal(result.status, 'INVALID');
  assert.equal(result.reason, 'DUPLICATE_TRAJECTORY_OBSERVATION');
});

test('graceful degradation reports latency and the first measured meltdown point', () => {
  const result = calculateGracefulDegradation({
    runs: [
      { load_point: 'baseline', success_rate: 0.98, latency_p95_ms: 100 },
      { load_point: 'medium', success_rate: 0.85, latency_p95_ms: 180 },
      { load_point: 'heavy', success_rate: 0.42, latency_p95_ms: 450 }
    ],
    meltdownSuccessThreshold: 0.5,
    latencyCeilingMs: 300,
    baselineVariance: 0.01
  });
  assert.equal(result.status, 'PASS');
  assert.equal(result.meltdown_onset_point, 'heavy');
  assert.equal(result.reliability_decay_curve.length, 3);
  assert.ok(result.variance_amplification_factor !== null);
});

test('graceful degradation requests more evidence instead of inventing a score', () => {
  const result = calculateGracefulDegradation({ runs: [{ load_point: 'baseline', success_rate: 0.98, latency_p95_ms: 100 }] });
  assert.equal(result.status, 'NEEDS_EVIDENCE');
  assert.equal(result.variance_amplification_factor, null);
});

test('verdict outputs use only the declared typed enum', () => {
  const values = new Set(['PROCEED', 'HOLD', 'REPAIR', 'KILL', 'NEEDS_EVIDENCE', 'QUARANTINE']);
  assert.ok(values.has(evaluate({ candidateId: 'RA_000001', verifiedAt: VERIFIED_AT, signalResults: {} }).typed_verdict));
  assert.ok(values.has(evaluateClone({ cloneId: 'clone-mtg-005', verifiedAt: VERIFIED_AT, dimensionResults: {} }).typed_verdict));
});
