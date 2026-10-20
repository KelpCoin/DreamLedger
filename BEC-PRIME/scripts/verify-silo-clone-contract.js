'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { validateSiloCloneContract, validateCloneManifest, createSignedVerdict, stableStringify } = require('../lib/siloCloneContract');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function validContract() {
  return {
    silo_id: 'mtg',
    fee_policy: { platform_fee_bps: 0, zero_fee_override: true, policy: 'PERMANENT_MTG_ZERO_PLATFORM_FEE' },
    authorship: { declared_tier: 'AAC', production_mode: 'AI_ASSISTED', human_review_required: true },
    support: { status: 'NOT_CONFIGURED' },
    content: { canonical_record_id: 'article-001', public_cutoff: 'NONE', paid_content_public_distribution: false },
    measurement: { evidence_path: 'records/attribution/mtg' },
    commerce: { checkout_enabled: false, inventory_verified: false, fulfillment_contract_verified: false, settlement_required: true, delivery_proof_required: true },
    security: {
      gauntlet_required: true,
      secret_scan_required: true,
      dependency_scan_required: true,
      silo_isolation_required: true,
      offline_first: true,
      signed_release_required: true,
      human_release_approval_required: true,
      local_worker_inbound_disabled: true,
      online_release_allowlist_only: true,
      offline_online_membrane: {
        directionality: 'FIGURE_EIGHT',
        online_to_offline: 'QUARANTINED_INPUT_ONLY',
        offline_to_online: 'SIGNED_APPROVED_ARTIFACTS_ONLY'
      }
    },
    x402: { enabled: false, live_approved: false }
  };
}

function realMtgManifest() {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'public', 'silos', 'mtg', 'silo.json'), 'utf8'));
}

test('real MTG source manifest passes with permanent explicit 0% fee override', () => {
  const manifest = realMtgManifest();
  const result = validateCloneManifest(manifest);
  assert.equal(result.status, 'PASS', JSON.stringify(result.errors));
  assert.equal(result.publish_allowed, true);
  assert.equal(manifest.clone_contract.fee_policy.platform_fee_bps, 0);
  assert.equal(manifest.clone_contract.fee_policy.zero_fee_override, true);
});

test('clone manifest with missing embedded policy fails closed', () => {
  const manifest = realMtgManifest();
  delete manifest.clone_contract;
  const result = validateCloneManifest(manifest);
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.some(e => e.code === 'CONTRACT_OBJECT_REQUIRED'));
  assert.ok(result.errors.some(e => e.code === 'CLONE_POLICY_REQUIRED'));
});

test('missing fee policy fails closed', () => {
  const contract = validContract();
  delete contract.fee_policy;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'FEE_POLICY_INVALID'));
});

test('0% fee without explicit override is rejected', () => {
  const contract = validContract();
  contract.fee_policy.zero_fee_override = false;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'ZERO_FEE_OVERRIDE_REQUIRED'));
});

test('MTG fake non-zero fee is rejected even when the contract says override=true', () => {
  const contract = validContract();
  contract.fee_policy.platform_fee_bps = 1500;
  const result = validateSiloCloneContract(contract);
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.some(e => e.code === 'ZERO_FEE_OVERRIDE_CONTRADICTS_RATE'));
  assert.ok(result.errors.some(e => e.code === 'MTG_ZERO_FEE_OVERRIDE_REQUIRED'));
});

test('missing authorship declaration fails closed', () => {
  const contract = validContract();
  delete contract.authorship;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'AUTHORSHIP_DECLARATION_REQUIRED'));
});

test('authorship tier cannot contradict recorded production mode', () => {
  const contract = validContract();
  contract.authorship.declared_tier = 'HCC';
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'AUTHORSHIP_TIER_MISMATCH'));
});

test('paid content is rejected if marked for public distribution', () => {
  const contract = validContract();
  contract.content.paid_content_public_distribution = true;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'PAYWALL_LEAK_RISK'));
});

test('missing public/paid cutoff is rejected', () => {
  const contract = validContract();
  delete contract.content.public_cutoff;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'PAYWALL_CUTOFF_REQUIRED'));
});

test('missing attribution/evidence path is rejected', () => {
  const contract = validContract();
  delete contract.measurement.evidence_path;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'MEASUREMENT_EVIDENCE_PATH_REQUIRED'));
});

test('checkout without verified inventory blocks', () => {
  const contract = validContract();
  contract.commerce.checkout_enabled = true;
  contract.commerce.inventory_verified = false;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'CHECKOUT_INVENTORY_UNVERIFIED'));
});

test('checkout without verified fulfillment blocks', () => {
  const contract = validContract();
  contract.commerce.checkout_enabled = true;
  contract.commerce.fulfillment_contract_verified = false;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'CHECKOUT_FULFILLMENT_UNVERIFIED'));
});

test('Gauntlet security requirements are mandatory', () => {
  const contract = validContract();
  contract.security.secret_scan_required = false;
  const result = validateSiloCloneContract(contract);
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.some(e => e.code === 'SECURITY_CONTROL_REQUIRED'));
});

test('offline-to-online Figure Eight membrane cannot be weakened', () => {
  const contract = validContract();
  contract.security.offline_online_membrane.offline_to_online = 'DIRECT_UPLOAD';
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'FIGURE_EIGHT_MEMBRANE_POLICY_REQUIRED'));
});

test('missing x402 state stays fail-closed', () => {
  const contract = validContract();
  delete contract.x402;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'X402_POLICY_REQUIRED'));
});

test('x402 enabled with placeholders and no approval is rejected', () => {
  const contract = validContract();
  contract.x402 = { enabled: true, network: 'CONFIGURE_BEFORE_LIVE', asset: 'USDC', pay_to: '0xabc', facilitator: 'https://facilitator.example', live_approved: false };
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'X402_NETWORK_INVALID'));
  assert.ok(result.errors.some(e => e.code === 'X402_LIVE_APPROVAL_REQUIRED'));
});

test('zero fee source field must match embedded fee policy', () => {
  const manifest = realMtgManifest();
  manifest.success_fee_peer = 0.15;
  const result = validateCloneManifest(manifest);
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.some(e => e.code === 'FEE_POLICY_SOURCE_MISMATCH'));
});

test('signed verdicts can be verified offline with the emitted public key', () => {
  const { privateKey } = require('node:crypto').generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const payload = { schema: 'test/v1', verdict: { status: 'PASS', silo_id: 'mtg' } };
  const signing = createSignedVerdict(payload, privatePem);
  assert.equal(signing.status, 'SIGNED');
  const publicKey = require('node:crypto').createPublicKey(signing.public_key);
  const valid = require('node:crypto').verify(null, Buffer.from(stableStringify(payload)), publicKey, Buffer.from(signing.signature, 'base64url'));
  assert.equal(valid, true);
});
