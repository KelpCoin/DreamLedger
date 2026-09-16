'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run: runCandidateGauntlet } = require('../gauntlet/CandidateGauntlet');
const { CONFIG, evaluateCandidate, readRunResult, cmdQueue } = require('../production/ProductionPromotionGate');

function candidateFixture() {
  return {
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
    proof_of_delivery: 'hash manifest',
    verification_rules: 'all checks pass',
    provenance: { private_material: 'excluded' },
    silo: 'dreamledger',
    kill_condition: 'any hard gate failure',
    artifact_path: 'BEC-PRIME/test-vectors/pong.html',
    artifact_kind: 'html'
  };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-promotion-'));
  const candidatePath = path.join(dir, 'candidate.json');
  const proofPath = path.join(dir, 'gate.json');
  const candidate = candidateFixture();
  fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));

  const result = await evaluateCandidate(candidatePath, proofPath);
  assert.strictEqual(result.hard_gate, 'PASS');
  assert.strictEqual(result.promotion_state, 'READY_FOR_APPROVAL');
  assert.strictEqual(result.approval_boundary, 'NO_AUTOMATIC_PUBLICATION');
  assert.strictEqual(result.elohim.can_publish, false);
  assert.strictEqual(result.elohim.can_charge_customer, false);
  assert.ok(fs.existsSync(proofPath));

  const runId = `RUN-TEST-PROMOTION-${Date.now()}`;
  const runDir = path.join(CONFIG.refinementDir, runId);
  const queuePath = path.join(CONFIG.queueDir, `${runId}.json`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(CONFIG.queueDir, { recursive: true });

  try {
    const runCandidatePath = path.join(runDir, 'candidate.json');
    const runGauntletPath = path.join(runDir, 'GAUNTLET-PROOF.json');
    const runResultPath = path.join(runDir, 'RESULT.json');
    fs.writeFileSync(runCandidatePath, JSON.stringify(candidate, null, 2));
    runCandidateGauntlet(candidate, runGauntletPath);
    fs.writeFileSync(runResultPath, JSON.stringify({
      schema_version: 'BEC-MULTILM-REFINEMENT-1.0',
      run_id: runId,
      status: 'READY_FOR_APPROVAL',
      candidate_path: runCandidatePath,
      gauntlet_path: runGauntletPath,
      completed_at: new Date().toISOString()
    }, null, 2));

    const run = readRunResult(runId);
    assert.strictEqual(run.runId, runId);
    assert.strictEqual(run.result.status, 'READY_FOR_APPROVAL');
    assert.strictEqual(run.gauntlet.status, 'PASS');

    const queued = cmdQueue(runId);
    assert.strictEqual(queued.state, 'READY_FOR_APPROVAL');
    assert.strictEqual(queued.run_id, runId);
    assert.ok(queued.ready_at);
    assert.strictEqual(queued.candidate_sha256, run.candidateSha256);

    const queuedAgain = cmdQueue(runId);
    assert.deepStrictEqual(queuedAgain, queued);

    const tampered = { ...candidate, name: 'TAMPERED' };
    fs.writeFileSync(runCandidatePath, JSON.stringify(tampered, null, 2));
    assert.throws(() => readRunResult(runId), /candidate hash mismatch/);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
    fs.rmSync(queuePath, { force: true });
  }

  console.log('PRODUCTION_PROMOTION_GATE=PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
