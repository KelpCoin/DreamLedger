'use strict';

const crypto = require('crypto');
const elohim = require('../elohim/ElohimV6');
const gauntlet = require('../gauntlet/CandidateGauntlet');

function canonical(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

async function verify(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('candidate must be an object');
  }

  const proposal = await elohim.propose({
    verification_type: 'commerce-candidate',
    candidate
  });

  const result = gauntlet.run(candidate);
  const passed = result.checks.filter(check => check.status === 'PASS').length;
  const total = result.checks.length;
  const score = total ? Math.round((passed / total) * 100) : 0;
  const verification = {
    type: 'dreamledger-internal-trust-verification',
    version: '1.0',
    verdict: result.status,
    trust_score: score,
    confidence: 'DETERMINISTIC_GAUNTLET',
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

module.exports = { verify };
