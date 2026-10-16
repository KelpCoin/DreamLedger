'use strict';

const crypto = require('node:crypto');

const ECONOMIC_STEPS = Object.freeze([
  { id: 'documented_signal', weight: 0.05, signals: ['source_url_verified', 'source_timestamp_verified', 'source_sha256_verified'] },
  { id: 'human_reviewed', weight: 0.05, signals: ['reviewer_identity_verified', 'review_notes_present', 'approval_signature_verified'] },
  { id: 'specific_offer', weight: 0.10, signals: ['canonical_offer_id_verified', 'price_currency_contract_verified', 'deliverable_scope_verified'] },
  { id: 'lawful_public_surface', weight: 0.05, signals: ['canonical_url_live_verified', 'compliance_gate_verified'] },
  { id: 'independent_buyer', weight: 0.15, signals: ['external_buyer_verified', 'buyer_independence_verified', 'self_purchase_excluded'] },
  { id: 'settled_payment', weight: 0.20, signals: ['processor_settlement_verified', 'amount_currency_payee_match', 'processor_event_signature_verified'] },
  { id: 'attributed_transaction', weight: 0.10, signals: ['order_id_resolved', 'canonical_sku_offer_match', 'silo_attribution_match', 'payment_idempotency_verified'] },
  { id: 'fulfillment_artifact', weight: 0.10, signals: ['artifact_hash_verified', 'artifact_matches_deliverable', 'durable_artifact_storage_verified'] },
  { id: 'delivery_confirmation', weight: 0.10, signals: ['delivery_timestamp_verified', 'recipient_delivery_confirmation_verified', 'receipt_binds_request_and_response'] },
  { id: 'independent_proof', weight: 0.10, signals: ['independent_verifier_passed', 'evidence_chain_verified', 'reversals_reconciled'] }
]);

const CLONE_DIMENSIONS = Object.freeze([
  { id: 'route_isolation', weight: 0.25 },
  { id: 'empty_catalogue_preservation', weight: 0.20 },
  { id: 'credential_separation', weight: 0.20 },
  { id: 'gauntlet_enforcement', weight: 0.20 },
  { id: 'checkout_disabled_by_default', weight: 0.15 }
]);

const TYPED_VERDICTS = Object.freeze([
  'PROCEED', 'HOLD', 'REPAIR', 'KILL', 'NEEDS_EVIDENCE', 'QUARANTINE'
]);

const VERIFIER_BY_SIGNAL = Object.freeze({
  source_url_verified: 'source-provenance-verifier',
  source_timestamp_verified: 'source-provenance-verifier',
  source_sha256_verified: 'source-provenance-verifier',
  reviewer_identity_verified: 'approval-verifier',
  review_notes_present: 'approval-verifier',
  approval_signature_verified: 'approval-verifier',
  canonical_offer_id_verified: 'offer-contract-verifier',
  price_currency_contract_verified: 'offer-contract-verifier',
  deliverable_scope_verified: 'offer-contract-verifier',
  canonical_url_live_verified: 'public-surface-verifier',
  compliance_gate_verified: 'compliance-verifier',
  external_buyer_verified: 'buyer-independence-verifier',
  buyer_independence_verified: 'buyer-independence-verifier',
  self_purchase_excluded: 'buyer-independence-verifier',
  processor_settlement_verified: 'settlement-verifier',
  amount_currency_payee_match: 'settlement-verifier',
  processor_event_signature_verified: 'settlement-verifier',
  order_id_resolved: 'attribution-verifier',
  canonical_sku_offer_match: 'attribution-verifier',
  silo_attribution_match: 'attribution-verifier',
  payment_idempotency_verified: 'attribution-verifier',
  artifact_hash_verified: 'artifact-verifier',
  artifact_matches_deliverable: 'artifact-verifier',
  durable_artifact_storage_verified: 'artifact-verifier',
  delivery_timestamp_verified: 'delivery-verifier',
  recipient_delivery_confirmation_verified: 'delivery-verifier',
  receipt_binds_request_and_response: 'delivery-verifier',
  independent_verifier_passed: 'truth-oracle-verifier',
  evidence_chain_verified: 'truth-oracle-verifier',
  reversals_reconciled: 'reconciliation-verifier'
});

const ALL_ECONOMIC_SIGNALS = Object.freeze(ECONOMIC_STEPS.flatMap(step => step.signals));
const ALL_CLONE_DIMENSIONS = Object.freeze(CLONE_DIMENSIONS.map(dimension => dimension.id));
const HASH_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function round6(value) {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000;
}

function validId(value) {
  return typeof value === 'string' && ID_RE.test(value);
}

function validateEvidenceRecord(record, expectedVerifier) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { status: 'UNKNOWN', issue: 'EVIDENCE_RECORD_MISSING' };
  }
  const status = record.status;
  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(status)) {
    return { status: 'INVALID', issue: 'INVALID_EVIDENCE_STATUS' };
  }
  if (status === 'UNKNOWN') return { status: 'UNKNOWN', issue: 'EVIDENCE_STATUS_UNKNOWN' };
  if (typeof record.evidence_ref !== 'string' || !record.evidence_ref.trim()
    || !HASH_RE.test(String(record.evidence_sha256 || ''))
    || record.verified_by !== expectedVerifier) {
    return { status: 'INVALID', issue: 'EVIDENCE_PROVENANCE_INVALID' };
  }
  return { status, issue: null };
}

function makeInvalidRecord(candidateId, reason, verifiedAt) {
  return {
    schema: 'DREAMLEDGER-VERDICT-RECORD/v1',
    candidate_id: validId(candidateId) ? candidateId : null,
    typed_verdict: 'QUARANTINE',
    completion_score: 0,
    score_domain: 'economic_event_steps_1_to_10_only',
    step_breakdown: {},
    missing_evidence: [],
    failed_evidence: [],
    invalid_evidence: [reason],
    next_action: 'quarantine_invalid_evaluation_input',
    confidence: 1,
    confidence_meaning: 'deterministic input-contract validation only, not probability of truth',
    verified_by: 'continuous-completion-evaluator-v1',
    verified_at: verifiedAt,
    binary_gate_pass: false,
    verified_economic_outcome: false,
    reason_codes: [reason]
  };
}

function evaluateEconomicEvent(input = {}) {
  const verifiedAt = typeof input.verifiedAt === 'string' ? input.verifiedAt : new Date().toISOString();
  if (!validId(input.candidateId)) return makeInvalidRecord(input.candidateId, 'INVALID_CANDIDATE_ID', verifiedAt);
  if (!input.signalResults || typeof input.signalResults !== 'object' || Array.isArray(input.signalResults)) {
    return makeInvalidRecord(input.candidateId, 'SIGNAL_RESULTS_OBJECT_REQUIRED', verifiedAt);
  }

  const unknownKeys = Object.keys(input.signalResults).filter(key => !ALL_ECONOMIC_SIGNALS.includes(key));
  if (unknownKeys.length) return makeInvalidRecord(input.candidateId, 'UNKNOWN_SIGNAL:' + unknownKeys.sort()[0], verifiedAt);

  const outcomes = {};
  const missingEvidence = [];
  const failedEvidence = [];
  const invalidEvidence = [];
  let score = 0;
  const stepBreakdown = {};

  for (const step of ECONOMIC_STEPS) {
    let passed = 0;
    const stepMissing = [];
    const stepFailed = [];
    const stepInvalid = [];
    for (const signal of step.signals) {
      const result = validateEvidenceRecord(input.signalResults[signal], VERIFIER_BY_SIGNAL[signal]);
      outcomes[signal] = result.status;
      if (result.status === 'PASS') passed += 1;
      else if (result.status === 'FAIL') {
        stepFailed.push(signal);
        failedEvidence.push(signal);
      } else if (result.status === 'INVALID') {
        stepInvalid.push(signal);
        invalidEvidence.push(signal + ':' + result.issue);
      } else {
        stepMissing.push(signal);
        missingEvidence.push(signal);
      }
    }
    const fraction = passed / step.signals.length;
    const weighted = step.weight * fraction;
    score += weighted;
    stepBreakdown[step.id] = {
      weight: step.weight,
      completion: round6(fraction),
      score: round6(weighted),
      passed_signals: passed,
      required_signals: step.signals.length,
      missing_signals: stepMissing,
      failed_signals: stepFailed,
      invalid_signals: stepInvalid
    };
  }

  const integrityConflicts = Array.isArray(input.integrityConflicts)
    ? input.integrityConflicts.filter(value => typeof value === 'string' && value.length > 0)
    : [];
  const fatalDefects = Array.isArray(input.fatalDefects)
    ? input.fatalDefects.filter(value => typeof value === 'string' && value.length > 0)
    : [];
  const repairableDefects = Array.isArray(input.repairableDefects)
    ? input.repairableDefects.filter(value => typeof value === 'string' && value.length > 0)
    : [];

  const outcome = input.finalOutcome || {};
  const finalOutcomeRecord = validateEvidenceRecord(outcome, 'economic-outcome-verifier');
  const finalOutcomeVerified = finalOutcomeRecord.status === 'PASS'
    && outcome.verified === true
    && typeof outcome.proof_ref === 'string' && outcome.proof_ref.trim().length > 0
    && outcome.settlement_reconciled === true
    && outcome.reversals_checked === true;

  if (finalOutcomeRecord.status === 'INVALID') invalidEvidence.push('finalOutcome:' + finalOutcomeRecord.issue);
  if (finalOutcomeRecord.status !== 'PASS' || !finalOutcomeVerified) {
    if (finalOutcomeRecord.status !== 'INVALID') missingEvidence.push('final_outcome_independent_verification');
  }

  const allTenStepsComplete = ALL_ECONOMIC_SIGNALS.every(signal => outcomes[signal] === 'PASS');
  const economicGatePass = allTenStepsComplete && finalOutcomeVerified;

  let typedVerdict;
  let nextAction;
  let reasons = [];
  if (fatalDefects.length) {
    typedVerdict = 'KILL';
    nextAction = 'terminate_candidate_and_preserve_evidence';
    reasons = fatalDefects.map(value => 'FATAL:' + value);
  } else if (integrityConflicts.length || input.safetyRisk === true || input.integrityRisk === true || invalidEvidence.length) {
    typedVerdict = 'QUARANTINE';
    nextAction = 'isolate_and_investigate_safety_or_integrity_risk';
    reasons = [
      ...integrityConflicts.map(value => 'INTEGRITY_CONFLICT:' + value),
      ...(input.safetyRisk === true ? ['SAFETY_RISK'] : []),
      ...(input.integrityRisk === true ? ['INTEGRITY_RISK'] : []),
      ...invalidEvidence.map(value => 'INVALID_EVIDENCE:' + value)
    ];
  } else if (economicGatePass) {
    typedVerdict = 'PROCEED';
    nextAction = 'record_verified_outcome_and_update_learning_signal';
    reasons = ['ALL_TEN_EVIDENCE_STEPS_PASS', 'FINAL_OUTCOME_INDEPENDENTLY_VERIFIED'];
  } else if (repairableDefects.length || failedEvidence.length) {
    typedVerdict = 'REPAIR';
    nextAction = 'repair_named_steps_and_rerun_deterministic_checks';
    reasons = [
      ...repairableDefects.map(value => 'REPAIRABLE:' + value),
      ...failedEvidence.map(value => 'EVIDENCE_CHECK_FAILED:' + value)
    ];
  } else if (missingEvidence.length) {
    typedVerdict = 'NEEDS_EVIDENCE';
    nextAction = 'dispatch_bounded_evidence_gathering_for_missing_signals';
    reasons = ['MISSING_OR_UNKNOWN_EVIDENCE'];
  } else if (input.waitingOnExternalEvent === true) {
    typedVerdict = 'HOLD';
    nextAction = 'wait_for_external_event_without_retrying_paid_actions';
    reasons = ['AWAITING_EXTERNAL_EVENT'];
  } else {
    typedVerdict = 'HOLD';
    nextAction = 'hold_candidate_for_review';
    reasons = ['ECONOMIC_GATE_NOT_COMPLETE'];
  }

  return {
    schema: 'DREAMLEDGER-VERDICT-RECORD/v1',
    candidate_id: input.candidateId,
    typed_verdict: typedVerdict,
    completion_score: round6(score),
    score_domain: 'economic_event_steps_1_to_10_only',
    step_breakdown: stepBreakdown,
    missing_evidence: [...new Set(missingEvidence)].sort(),
    failed_evidence: [...new Set(failedEvidence)].sort(),
    invalid_evidence: [...new Set(invalidEvidence)].sort(),
    final_outcome_evidence: {
      independently_verified: finalOutcomeVerified,
      verifier: finalOutcomeRecord.status === 'PASS' ? outcome.verified_by : null,
      proof_ref_present: typeof outcome.proof_ref === 'string' && outcome.proof_ref.trim().length > 0,
      settlement_reconciled: outcome.settlement_reconciled === true,
      reversals_checked: outcome.reversals_checked === true
    },
    binary_gate_pass: economicGatePass,
    verified_economic_outcome: economicGatePass,
    next_action: nextAction,
    confidence: 1,
    confidence_meaning: 'deterministic rule application to provenance-bound evidence records; not a probability estimate',
    verified_by: 'continuous-completion-evaluator-v1',
    verified_at: verifiedAt,
    reason_codes: reasons
  };
}

function evaluateCloneIsolation(input = {}) {
  const verifiedAt = typeof input.verifiedAt === 'string' ? input.verifiedAt : new Date().toISOString();
  if (!validId(input.cloneId)) {
    return {
      schema: 'DREAMLEDGER-CLONE-ISOLATION-SCORE/v1',
      clone_id: null,
      typed_verdict: 'QUARANTINE',
      completion_score: 0,
      dimension_breakdown: {},
      missing_evidence: [],
      failed_evidence: [],
      binary_gate_pass: false,
      release_ready: false,
      next_action: 'quarantine_invalid_clone_assessment',
      verified_at: verifiedAt
    };
  }
  if (!input.dimensionResults || typeof input.dimensionResults !== 'object' || Array.isArray(input.dimensionResults)) {
    return {
      schema: 'DREAMLEDGER-CLONE-ISOLATION-SCORE/v1',
      clone_id: input.cloneId,
      typed_verdict: 'NEEDS_EVIDENCE',
      completion_score: 0,
      dimension_breakdown: {},
      missing_evidence: ALL_CLONE_DIMENSIONS.slice(),
      failed_evidence: [],
      binary_gate_pass: false,
      release_ready: false,
      next_action: 'gather_exact_key_clone_isolation_evidence',
      verified_at: verifiedAt
    };
  }

  const extras = Object.keys(input.dimensionResults).filter(key => !ALL_CLONE_DIMENSIONS.includes(key));
  if (extras.length) {
    return {
      schema: 'DREAMLEDGER-CLONE-ISOLATION-SCORE/v1',
      clone_id: input.cloneId,
      typed_verdict: 'QUARANTINE',
      completion_score: 0,
      dimension_breakdown: {},
      missing_evidence: [],
      failed_evidence: [],
      binary_gate_pass: false,
      release_ready: false,
      next_action: 'quarantine_unknown_clone_dimension',
      reason_codes: ['UNKNOWN_CLONE_DIMENSION:' + extras.sort()[0]],
      verified_at: verifiedAt
    };
  }

  let score = 0;
  const breakdown = {};
  const missingEvidence = [];
  const failedEvidence = [];
  const invalidEvidence = [];
  for (const dimension of CLONE_DIMENSIONS) {
    const result = validateEvidenceRecord(input.dimensionResults[dimension.id], 'clone-isolation-verifier');
    let earned = 0;
    if (result.status === 'PASS') earned = dimension.weight;
    else if (result.status === 'UNKNOWN') missingEvidence.push(dimension.id);
    else if (result.status === 'FAIL') failedEvidence.push(dimension.id);
    else invalidEvidence.push(dimension.id + ':' + result.issue);
    score += earned;
    breakdown[dimension.id] = {
      weight: dimension.weight,
      score: round6(earned),
      status: result.status,
      evidence_ref: result.status === 'PASS' || result.status === 'FAIL' ? input.dimensionResults[dimension.id].evidence_ref : null
    };
  }

  const allDimensionsPass = ALL_CLONE_DIMENSIONS.every(id => breakdown[id].status === 'PASS');
  const releaseApproval = validateEvidenceRecord(input.releaseApproval, 'clone-release-verifier');
  const releaseApprovalValid = releaseApproval.status === 'PASS'
    && input.releaseApproval.approved === true;
  const releaseReady = allDimensionsPass && releaseApprovalValid;

  let verdict = 'HOLD';
  let nextAction = 'hold_clone_for_review';
  let reasons = [];
  if (input.safetyRisk === true || input.integrityRisk === true || invalidEvidence.length || releaseApproval.status === 'INVALID') {
    verdict = 'QUARANTINE';
    nextAction = 'quarantine_clone_and_investigate';
    reasons = [
      ...(input.safetyRisk === true ? ['SAFETY_RISK'] : []),
      ...(input.integrityRisk === true ? ['INTEGRITY_RISK'] : []),
      ...invalidEvidence,
      ...(releaseApproval.status === 'INVALID' ? ['INVALID_RELEASE_APPROVAL_EVIDENCE'] : [])
    ];
  } else if (releaseReady) {
    verdict = 'PROCEED';
    nextAction = 'eligible_for_separate_master_template_certification_review';
    reasons = ['ALL_FIVE_ISOLATION_DIMENSIONS_PASS', 'INDEPENDENT_RELEASE_APPROVAL_VERIFIED'];
  } else if (failedEvidence.length) {
    verdict = 'REPAIR';
    nextAction = 'repair_failed_clone_isolation_dimensions';
    reasons = failedEvidence.map(value => 'CLONE_DIMENSION_FAILED:' + value);
  } else if (missingEvidence.length || releaseApproval.status !== 'PASS') {
    verdict = 'NEEDS_EVIDENCE';
    nextAction = 'gather_missing_clone_or_approval_evidence';
    reasons = ['CLONE_OR_RELEASE_APPROVAL_EVIDENCE_MISSING'];
  }

  return {
    schema: 'DREAMLEDGER-CLONE-ISOLATION-SCORE/v1',
    clone_id: input.cloneId,
    typed_verdict: verdict,
    completion_score: round6(score),
    dimension_breakdown: breakdown,
    missing_evidence: [...new Set(missingEvidence)].sort(),
    failed_evidence: [...new Set(failedEvidence)].sort(),
    binary_gate_pass: allDimensionsPass,
    release_ready: releaseReady,
    next_action: nextAction,
    confidence: 1,
    confidence_meaning: 'deterministic rule application to provenance-bound test records; not a probability estimate',
    verified_by: 'continuous-completion-evaluator-v1',
    verified_at: verifiedAt,
    reason_codes: reasons
  };
}

function evaluateTrajectory(records = []) {
  if (!Array.isArray(records)) {
    return { status: 'INVALID', reason: 'RECORD_ARRAY_REQUIRED', observations: 0, regression_count: 0, repeated_score_count: 0 };
  }
  const normalized = [];
  const seen = new Set();
  for (const record of records) {
    if (!record || !validId(record.candidate_id) || !Number.isFinite(record.completion_score)
      || record.completion_score < 0 || record.completion_score > 1
      || typeof record.verified_at !== 'string') {
      return { status: 'INVALID', reason: 'INVALID_TRAJECTORY_RECORD', observations: normalized.length, regression_count: 0, repeated_score_count: 0 };
    }
    const identity = record.candidate_id + ':' + record.verified_at;
    if (seen.has(identity)) return { status: 'INVALID', reason: 'DUPLICATE_TRAJECTORY_OBSERVATION', observations: normalized.length, regression_count: 0, repeated_score_count: 0 };
    seen.add(identity);
    normalized.push({
      candidate_id: record.candidate_id,
      completion_score: record.completion_score,
      verified_at: record.verified_at,
      binary_gate_pass: record.binary_gate_pass === true
    });
  }
  normalized.sort((a, b) => a.verified_at.localeCompare(b.verified_at));
  const deltas = [];
  let regressionCount = 0;
  let repeatedScoreCount = 0;
  for (let i = 1; i < normalized.length; i++) {
    const delta = round6(normalized[i].completion_score - normalized[i - 1].completion_score);
    deltas.push({ from: normalized[i - 1].completion_score, to: normalized[i].completion_score, delta, at: normalized[i].verified_at });
    if (delta < 0) regressionCount += 1;
    if (delta === 0) repeatedScoreCount += 1;
  }
  return {
    status: 'PASS',
    observations: normalized.length,
    regression_count: regressionCount,
    repeated_score_count: repeatedScoreCount,
    deltas,
    trajectory: normalized,
    interpretation: 'Regressions and repeated scores are surfaced, never hidden or automatically relabeled as progress.'
  };
}

function calculateGracefulDegradation(input = {}) {
  const runs = input.runs;
  if (!Array.isArray(runs) || runs.length < 2) {
    return { status: 'NEEDS_EVIDENCE', reason: 'AT_LEAST_TWO_ORDERED_LOAD_POINTS_REQUIRED', reliability_decay_curve: [], variance_amplification_factor: null, meltdown_onset_point: null };
  }
  for (const run of runs) {
    if (!run || typeof run.load_point !== 'string' || !run.load_point
      || !Number.isFinite(run.success_rate) || run.success_rate < 0 || run.success_rate > 1
      || !Number.isFinite(run.latency_p95_ms) || run.latency_p95_ms < 0) {
      return { status: 'INVALID', reason: 'INVALID_LOAD_OBSERVATION', reliability_decay_curve: [], variance_amplification_factor: null, meltdown_onset_point: null };
    }
  }
  const baseline = runs[0];
  const rates = runs.map(run => run.success_rate);
  const mean = rates.reduce((sum, value) => sum + value, 0) / rates.length;
  const observedVariance = rates.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / rates.length;
  const baselineVariance = Number.isFinite(input.baselineVariance) && input.baselineVariance > 0 ? input.baselineVariance : null;
  const decay = runs.map(run => ({
    load_point: run.load_point,
    success_rate: run.success_rate,
    delta_from_baseline: round6(run.success_rate - baseline.success_rate),
    latency_p95_ms: run.latency_p95_ms
  }));
  const successThreshold = Number.isFinite(input.meltdownSuccessThreshold) ? input.meltdownSuccessThreshold : 0.5;
  const latencyCeiling = Number.isFinite(input.latencyCeilingMs) ? input.latencyCeilingMs : null;
  const onset = runs.find(run => run.success_rate < successThreshold || (latencyCeiling !== null && run.latency_p95_ms > latencyCeiling));
  return {
    status: 'PASS',
    reliability_decay_curve: decay,
    variance_amplification_factor: baselineVariance === null ? null : round6(observedVariance / baselineVariance),
    meltdown_onset_point: onset ? onset.load_point : null,
    meltdown_rule: {
      success_rate_below: successThreshold,
      latency_p95_ms_above: latencyCeiling
    },
    interpretation: 'Descriptive stress measurements only; do not treat them as a validated composite GDS until benchmark thresholds are calibrated.'
  };
}

module.exports = {
  ECONOMIC_STEPS,
  CLONE_DIMENSIONS,
  TYPED_VERDICTS,
  VERIFIER_BY_SIGNAL,
  evaluateEconomicEvent,
  evaluateCloneIsolation,
  evaluateTrajectory,
  calculateGracefulDegradation,
  sha256
};
