'use strict';

const fs = require('fs');
const path = require('path');
const policy = require('../autonomy/AutonomousPolicyV1');

const root = path.join(__dirname, '..');
const proofDir = path.join(root, 'data', 'proofs');
fs.mkdirSync(proofDir, { recursive: true });

const tests = [];
function check(name, fn) {
  try {
    const result = fn();
    tests.push({ name, status: result === true ? 'PASS' : 'FAIL', result });
  } catch (error) {
    tests.push({ name, status: 'FAIL', error: String(error && error.message || error) });
  }
}

check('constitution', () => policy.assertConstitution().status === 'PASS');
check('read_only_autonomy', () => policy.evaluate({ tool: 'dl_read_inventory' }, { truth_status: 'VERIFIED', silo_allowed: true }).decision === 'AUTONOMOUS_ALLOWED');
check('offer_requires_authority', () => policy.evaluate({ tool: 'dl_propose_offer' }, { truth_status: 'VERIFIED', silo_allowed: true }).decision === 'HUMAN_APPROVAL_REQUIRED');
check('checkout_requires_authority', () => policy.evaluate({ tool: 'dl_propose_checkout' }, { truth_status: 'VERIFIED', silo_allowed: true }).decision === 'HUMAN_APPROVAL_REQUIRED');
check('self_approval_blocked', () => policy.evaluate({ tool: 'dl_propose_checkout', approve: true }, { truth_status: 'VERIFIED', silo_allowed: true }).decision === 'BLOCKED');
check('execution_blocked', () => policy.evaluate({ tool: 'dl_propose_checkout', execute: true }, { truth_status: 'VERIFIED', silo_allowed: true }).decision === 'BLOCKED');
check('stale_evidence_blocked', () => policy.evaluate({ tool: 'dl_read_inventory' }, { truth_status: 'STALE', silo_allowed: true }).decision === 'BLOCKED');
check('gauntlet_failure_blocked', () => policy.evaluate({ tool: 'dl_read_inventory' }, { truth_status: 'VERIFIED', gauntlet_status: 'FAIL', silo_allowed: true }).decision === 'BLOCKED');
check('cross_silo_blocked', () => policy.evaluate({ tool: 'dl_read_inventory' }, { truth_status: 'VERIFIED', silo_allowed: false }).decision === 'BLOCKED');
check('credential_access_blocked', () => policy.evaluate({ tool: 'dl_read_inventory' }, { truth_status: 'VERIFIED', silo_allowed: true, credentials_requested: true }).decision === 'BLOCKED');
check('unknown_tool_blocked', () => policy.evaluate({ tool: 'dl_charge_customer' }, { truth_status: 'VERIFIED', silo_allowed: true }).decision === 'BLOCKED');

const failed = tests.filter(t => t.status !== 'PASS');
const proof = {
  schema_version: 'BEC-AUTONOMY-POLICY-1.0',
  status: failed.length ? 'FAIL' : 'PASS',
  generated_at: new Date().toISOString(),
  execution_model: 'AUTONOMOUS_OBSERVATION_AND_PROPOSAL',
  autonomous_spend: false,
  self_approval: false,
  public_posting: false,
  tool_count: policy.TOOLS.length,
  tests
};

const out = path.join(proofDir, 'AUTONOMOUS-POLICY-V1-LATEST.json');
fs.writeFileSync(out, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
process.exit(failed.length ? 1 : 0);
