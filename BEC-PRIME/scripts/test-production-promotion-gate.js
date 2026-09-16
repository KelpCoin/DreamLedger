'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateCandidate } = require('../production/ProductionPromotionGate');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-promotion-'));
  const candidatePath = path.join(dir, 'candidate.json');
  const proofPath = path.join(dir, 'gate.json');
  const candidate = {
    candidate_id: 'TEST-PROMOTION-001',
    offer_id: 'TEST-PROMOTION-001',
    name: 'Production gate test artifact',
    problem: 'Verify promotion boundaries',
    target_buyer: 'test buyer',
    deliverable: 'deterministic HTML artifact',
    delivery_mechanism: 'test fixture',
    price: 1,
    currency: 'NZD',
    payment_adapter: 'stripe',
    checkout_route: '/test-checkout',
    approval_required: true,
    checkout_available: false,
    status: 'CANDIDATE',
    state: 'READY_FOR_APPROVAL',
    proof_of_delivery: 'hash manifest',
    verification_rules: 'all checks pass',
    provenance: { private_material: 'excluded' },
    silo: 'dreamledger',
    kill_condition: 'any hard gate failure',
    artifact_path: 'BEC-PRIME/test-vectors/pong.html',
    artifact_kind: 'html',
    ready_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  };
  fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));
  const result = await evaluateCandidate(candidatePath, proofPath);
  assert.strictEqual(result.hard_gate, 'PASS');
  assert.strictEqual(result.promotion_state, 'READY_FOR_APPROVAL');
  assert.strictEqual(result.approval_boundary, 'NO_AUTOMATIC_PUBLICATION');
  assert.strictEqual(result.elohim.can_publish, false);
  assert.strictEqual(result.elohim.can_charge_customer, false);
  assert.ok(fs.existsSync(proofPath));
  console.log('PRODUCTION_PROMOTION_GATE=PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
