'use strict';

const crypto = require('crypto');
const elohim = require('../elohim/ElohimV6');
const gauntlet = require('../gauntlet/CandidateGauntlet');

const WEIGHTS = { sensitivity: 0.40, complexity: 0.30, compliance: 0.30 };
const THRESHOLDS = { warning: 3, limitation: 6, suspend: 7 };

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
  const sensitivity = normalise(source.sensitivity ?? source.S);
  const complexity = normalise(source.complexity ?? source.C);
  const compliance = normalise(source.compliance ?? source.R);
  const score = (WEIGHTS.sensitivity * sensitivity) + (WEIGHTS.complexity * complexity) + (WEIGHTS.compliance * compliance);
  const action = score >= THRESHOLDS.suspend ? 'SUSPEND_MANUAL_REVIEW' : score >= THRESHOLDS.warning ? (score >= 4 ? 'SERVICE_LIMITATION' : 'EMAIL_WARNING_REMEDIATION') : 'EMAIL_WARNING_REMEDIATION';
  return {
    raw: { sensitivity: source.sensitivity ?? source.S, complexity: source.complexity ?? source.C, compliance: source.compliance ?? source.R },
    normalised: { sensitivity, complexity, compliance },
    weights: WEIGHTS,
    score: Number(score.toFixed(4)),
    score_0_10: Number((score * 10).toFixed(4)),
    action,
    thresholds: THRESHOLDS,
    correlation_status: candidate.correlation_status || 'UNSUPPLIED',
    correlation_flag: Boolean(candidate.correlation_flag)
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
  if (candidate.risk || candidate.trust || ['S','C','R','sensitivity','complexity','compliance'].some(k => Object.prototype.hasOwnProperty.call(candidate, k))) {
    risk = trustRisk(candidate);
  }

  const verification = {
    type: 'dreamledger-internal-trust-verification',
    version: '2.0',
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
