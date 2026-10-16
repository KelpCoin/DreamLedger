'use strict';

const evaluator = require('./ContinuousCompletionEvaluator');
const defaultLedger = require('../runtime/Ledger');

function requiredLedger(ledger) {
  return Boolean(ledger
    && typeof ledger.sha256 === 'function'
    && typeof ledger.canonical === 'function'
    && typeof ledger.verifyChain === 'function'
    && typeof ledger.appendEventIdempotent === 'function');
}

function safeEvidenceRefs(input) {
  const refs = [];
  const records = input && input.signalResults && typeof input.signalResults === 'object'
    ? Object.values(input.signalResults) : [];
  for (const record of records) {
    if (record && typeof record.evidence_ref === 'string' && record.evidence_ref.trim()) {
      refs.push(record.evidence_ref.trim());
    }
  }
  const dimensions = input && input.dimensionResults && typeof input.dimensionResults === 'object'
    ? Object.values(input.dimensionResults) : [];
  for (const record of dimensions) {
    if (record && typeof record.evidence_ref === 'string' && record.evidence_ref.trim()) {
      refs.push(record.evidence_ref.trim());
    }
  }
  const outcome = input && input.finalOutcome;
  if (outcome && typeof outcome.proof_ref === 'string' && outcome.proof_ref.trim()) refs.push(outcome.proof_ref.trim());
  const releaseApproval = input && input.releaseApproval;
  if (releaseApproval && typeof releaseApproval.evidence_ref === 'string' && releaseApproval.evidence_ref.trim()) refs.push(releaseApproval.evidence_ref.trim());
  return [...new Set(refs)].sort();
}

function recordVerdict(eventType, candidateId, input, verdict, ledger) {
  if (!requiredLedger(ledger)) {
    return { recorded: false, status: 'HOLD_LEDGER_ADAPTER_UNAVAILABLE', verdict_record: verdict };
  }

  let chain;
  try { chain = ledger.verifyChain(); } catch (_) {
    return { recorded: false, status: 'HOLD_LEDGER_CHAIN_UNVERIFIABLE', verdict_record: verdict };
  }
  if (!chain || chain.status !== 'PASS') {
    return { recorded: false, status: 'HOLD_LEDGER_CHAIN_INVALID', ledger_status: chain && chain.status || 'UNKNOWN', verdict_record: verdict };
  }

  const inputHash = ledger.sha256(input);
  const outputHash = ledger.sha256(verdict);
  const eventId = 'evt_completion_' + ledger.sha256({
    event_type: eventType,
    candidate_id: candidateId,
    input_hash: inputHash,
    output_hash: outputHash,
    verified_at: verdict.verified_at
  });

  let appended;
  try {
    appended = ledger.appendEventIdempotent({
      event_id: eventId,
      timestamp: verdict.verified_at,
      graph_id: 'DREAMLEDGER-FIGURE-EIGHT',
      branch_id: candidateId,
      node_id: 'continuous-completion-evaluator-v1',
      event_type: eventType,
      silo: 'BEC-PRIME',
      actor: { type: 'deterministic-evaluator', id: 'continuous-completion-evaluator-v1' },
      inputs_hash: 'sha256:' + inputHash,
      outputs_hash: 'sha256:' + outputHash,
      payload: {
        verdict_record: verdict,
        evidence_refs: safeEvidenceRefs(input),
        score_only_not_revenue: true
      },
      evidence_refs: safeEvidenceRefs(input),
      claims: { payment_claim: false, sale_claim: false, fulfillment_claim: false },
      result: verdict.typed_verdict
    });
  } catch (error) {
    return {
      recorded: false,
      status: 'HOLD_LEDGER_APPEND_FAILED',
      error_class: error && error.name || 'Error',
      verdict_record: verdict
    };
  }

  let after;
  try { after = ledger.verifyChain(); } catch (_) {
    return { recorded: false, status: 'HOLD_LEDGER_POST_APPEND_CHAIN_UNVERIFIABLE', verdict_record: verdict, event_id: eventId };
  }
  if (!after || after.status !== 'PASS') {
    return { recorded: false, status: 'HOLD_LEDGER_POST_APPEND_CHAIN_INVALID', verdict_record: verdict, event_id: eventId };
  }

  return {
    recorded: true,
    status: appended && appended.idempotent ? 'RECORDED_IDEMPOTENT' : 'RECORDED',
    event_id: eventId,
    event_hash: appended && appended.event ? appended.event.event_hash || null : null,
    ledger_chain_status: after.status,
    verdict_record: verdict
  };
}

function evaluateAndRecordEconomicEvent(input = {}, options = {}) {
  const ledger = options.ledger || defaultLedger;
  const normalized = {
    ...input,
    verifiedAt: input.verifiedAt || new Date().toISOString()
  };
  const verdict = evaluator.evaluateEconomicEvent(normalized, {
    verifyEvidence: options.verifyEvidence
  });
  if (options.persist === false) return { recorded: false, status: 'NOT_PERSISTED_BY_REQUEST', verdict_record: verdict };
  return recordVerdict('GAUNTLET_CONTINUOUS_COMPLETION_EVALUATED', normalized.candidateId, normalized, verdict, ledger);
}

function evaluateAndRecordCloneIsolation(input = {}, options = {}) {
  const ledger = options.ledger || defaultLedger;
  const normalized = {
    ...input,
    verifiedAt: input.verifiedAt || new Date().toISOString()
  };
  const verdict = evaluator.evaluateCloneIsolation(normalized, {
    verifyEvidence: options.verifyEvidence
  });
  if (options.persist === false) return { recorded: false, status: 'NOT_PERSISTED_BY_REQUEST', verdict_record: verdict };
  return recordVerdict('GAUNTLET_CLONE_ISOLATION_EVALUATED', normalized.cloneId, normalized, verdict, ledger);
}

module.exports = {
  evaluateAndRecordEconomicEvent,
  evaluateAndRecordCloneIsolation
};
