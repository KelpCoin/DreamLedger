'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { verify } = require('../trust/InternalTrustService');

async function main() {
  const candidate = {
    offer_id: 'TEST-INTERNAL-TRUST',
    name: 'Internal Trust Service Test',
    problem: 'Verify the private trust pipeline.',
    target_buyer: 'Internal test harness',
    deliverable: 'Deterministic verification result',
    delivery_mechanism: 'test',
    price: 29,
    currency: 'NZD',
    payment_adapter: 'test',
    checkout_route: '/api/offer-checkout/create',
    approval_required: true,
    checkout_available: false,
    status: 'PROPOSED',
    proof_of_delivery: 'test-proof',
    verification_rules: ['deterministic'],
    provenance: { private_material: 'excluded' },
    silo: 'system',
    kill_condition: 'test failure'
  };

  const result = await verify(candidate);
  assert.strictEqual(result.verdict, 'PASS');
  assert.strictEqual(result.trust_score, 100);
  assert.strictEqual(result.confidence, 'DETERMINISTIC_GAUNTLET');
  assert.match(result.candidate_hash, /^[a-f0-9]{64}$/);
  assert.match(result.proof_hash, /^[a-f0-9]{64}$/);
  assert.match(result.elohim_proposal_id, /^ELOHIM-P-/);

  const expected = crypto.createHash('sha256').update(JSON.stringify({
    type: result.type,
    version: result.version,
    verdict: result.verdict,
    trust_score: result.trust_score,
    confidence: result.confidence,
    candidate_offer_id: result.candidate_offer_id,
    candidate_hash: result.candidate_hash,
    elohim_proposal_id: result.elohim_proposal_id,
    checks_passed: result.checks_passed,
    checks_total: result.checks_total,
    public_execution: result.public_execution
  }, Object.keys(result).filter(key => key !== 'proof_hash').sort())).digest('hex');
  assert.strictEqual(result.proof_hash, expected);

  console.log(JSON.stringify({ status: 'PASS', verdict: result.verdict, trust_score: result.trust_score, proof_hash: result.proof_hash }, null, 2));
}

main().catch(err => { console.error(err.stack || err.message); process.exit(1); });
