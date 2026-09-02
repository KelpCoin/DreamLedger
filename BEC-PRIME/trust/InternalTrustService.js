'use strict';

const crypto = require('crypto');
const elohim = require('../elohim/ElohimV6');
const gauntlet = require('../gauntlet/CandidateGauntlet');

const WEIGHTS = { sensitivity: 0.40, complexity: 0.30, compliance: 0.30 };
const THRESHOLDS = { warning_max: 3, limitation_max: 6, suspend_min: 7 };

function canonical(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalise(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error('risk attributes must be numbers in [0,10]');
  return n / 10;
}

function trustRisk(candidate) {
  const source = candidate.risk || candidate.trust || candidate;
  const rawSensitivity = source.sensitivity ?? source.S;
  const rawComplexity = source.complexity ?? source.C;
  const rawCompliance = source.compliance ?? source.R;
  const sensitivity = normalise(rawSensitivity);
  const complexity = normalise(rawComplexity);
  const compliance = normalise(rawCompliance);
  const score10 = (WEIGHTS.sensitivity * sensitivity + WEIGHTS.complexity * complexity + WEIGHTS.compliance * compliance) * 10;
  const action = score10 >= THRESHOLDS.suspend_min
    ? 'SUSPEND_MANUAL_REVIEW'
    : score10 >= 4
      ? 'SERVICE_LIMITATION'
      : 'EMAIL_WARNING_REMEDIATION';
  const correlation = candidate.correlation || candidate.correlation_matrix || null;
  let correlationFlag = Boolean(candidate.correlation_flag);
  let maxAbsCorrelation = null;
  if (correlation && typeof correlation === 'object') {
    const values = [];
    for (const key of ['S_R', 'R_S', 'S,C', 'C,S', 'S_R_correlation', 'S_C', 'C_R']) {
      const value = Number(correlation[key]);
      if (Number.isFinite(value)) values.push(Math.abs(value));
    }
    if (values.length) maxAbsCorrelation = Math.max.apply(null, values);
    if (maxAbsCorrelation !== null && maxAbsCorrelation > 0.40) correlationFlag = true;
  }
  return {
    raw: { sensitivity: rawSensitivity, complexity: rawComplexity, compliance: rawCompliance },
    normalised: { sensitivity, complexity, compliance },
    weights: WEIGHTS,
    score: Number(score10.toFixed(4)),
    score_0_10: Number(score10.toFixed(4)),
    action,
    thresholds: THRESHOLDS,
    correlation_status: candidate.correlation_status || (correlationFlag ? 'RETRAIN_OR_EXTEND' : 'OK_OR_UNSUPPLIED'),
    correlation_flag: correlationFlag,
    max_abs_correlation: maxAbsCorrelation
  };
}

async function verify(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('candidate must be an object');

  const proposal = await elohim.propose({ verification_type: 'commerce-candidate', candidate });
  const result = gauntlet.run(candidate);
  const passed = result.checks.filter(check => check.status === 'PASS').length;
  const total = result.checks.length;
  const gauntletScore = total ? Math.round((passed / total) * 100) : 0;
  let risk = null;
  if (candidate.risk || candidate.trust || ['S','C','R','sensitivity','complexity','compliance'].some(k => Object.prototype.hasOwnProperty.call(candidate, k))) risk = trustRisk(candidate);

  const verification = {
    type: 'dreamledger-internal-trust-verification',
    version: '2.1',
    verdict: result.status,
    trust_score: risk ? risk.score_0_10 : gauntletScore,
    risk_engine: risk,
    confidence: risk ? 'THREE_FACTOR_RISK_MODEL_PLUS_DETERMINISTIC_GAUNTLET' : 'DETERMINISTIC_GAUNTLET',
    candidate_offer_id: candidate.offer_id || null,
    candidate_hash: result.candidate_hash,
    elohim_proposal_id: proposal.proposal_id,
    checks_passed: passed,
    checks_total: total,
    public_execution: 'BLOCKED_UNTIL_HUMAN_APPROVAL'
  };

  verification.proof_hash = sha256(canonical(verification));
  return verification;
}

module.exports = { verify, trustRisk, WEIGHTS, THRESHOLDS };
