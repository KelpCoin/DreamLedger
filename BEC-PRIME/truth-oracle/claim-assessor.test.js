'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const keyPair = crypto.generateKeyPairSync('ed25519');
const evidencePrivatePem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const evidencePublicPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const trustedEvidenceKeys = { 'evidence-test-key': evidencePublicPem };
const contract = require('../../config/truth-oracle-contract.json');
const { assessClaim, signReceipt, verifySignedReceipt, canonicalJson } = require('./claim-assessor.js');

function assess(item, options = {}) {
  return assessClaim(item, contract, { trustedEvidenceKeys, ...options });
}

function source(id, relation, role = 'PRIMARY', group = id) {
  const record = {
    evidence_id: id,
    source_url: 'https://' + id.toLowerCase() + '.example.org/record',
    source_role: role,
    independence_group: group,
    observed_at: '2026-10-20T10:00:00.000Z',
    content_sha256: crypto.createHash('sha256').update('body for ' + id).digest('hex'),
    excerpt: 'Evidence excerpt for ' + id,
    admission_status: 'VERIFIED',
    relation
  };
  record.attestation = {
    algorithm: 'Ed25519',
    key_id: 'evidence-test-key',
    signature: crypto.sign(null, Buffer.from(canonicalJson(record), 'utf8'), keyPair.privateKey).toString('base64')
  };
  return record;
}
function input() {
  return {
    claim_id: 'CLAIM-001',
    claim_text: 'The documented total is 100.',
    claim_type: 'documented_numeric_fact',
    evaluated_at: '2026-10-20T10:30:00.000Z',
    evidence: [source('PRIMARY-A', 'SUPPORTS'), source('PRIMARY-B', 'SUPPORTS')],
    deterministic_checks: [{
      check_id: 'NUMERIC-EXTRACTION-MATCH',
      status: 'PASS',
      evidence_ids: ['PRIMARY-A', 'PRIMARY-B'],
      verifier_id: 'deterministic-numeric-comparator-v1'
    }]
  };
}

test('two independent primary sources plus evidence-backed passing checks are VERIFIED', () => {
  const receipt = assess(input());
  assert.equal(receipt.status, 'VERIFIED');
  assert.equal(receipt.confidence, null);
  assert.equal(receipt.source_summary.independent_primary_support_groups, 2);
  assert.match(receipt.evidence_hash, /^[a-f0-9]{64}$/);
  assert.match(receipt.receipt_hash, /^[a-f0-9]{64}$/);
});

test('two independent secondary sources may be LIKELY but not VERIFIED', () => {
  const item = input();
  item.evidence = [source('SECONDARY-A', 'SUPPORTS', 'SECONDARY'), source('SECONDARY-B', 'SUPPORTS', 'SECONDARY')];
  item.deterministic_checks = [];
  const receipt = assess(item);
  assert.equal(receipt.status, 'LIKELY');
  assert.equal(receipt.confidence, null);
});

test('conflicting evidence is UNCERTAIN even when a model votes confidently', () => {
  const item = input();
  item.evidence.push(source('PRIMARY-C', 'CONTRADICTS', 'PRIMARY'));
  item.model_opinions = [
    { model_id: 'local-model-a', verdict: 'VERIFIED' },
    { model_id: 'local-model-b', verdict: 'VERIFIED' },
    { model_id: 'local-model-c', verdict: 'VERIFIED' }
  ];
  const receipt = assess(item);
  assert.equal(receipt.status, 'UNCERTAIN');
  assert.equal(receipt.confidence, null);
});

test('two primary contradiction groups can produce CONTRADICTED', () => {
  const item = input();
  item.evidence = [source('PRIMARY-A', 'CONTRADICTS'), source('PRIMARY-B', 'CONTRADICTS')];
  item.deterministic_checks = [{
    check_id: 'CHECK-FAIL',
    status: 'FAIL',
    evidence_ids: ['PRIMARY-A', 'PRIMARY-B'],
    verifier_id: 'deterministic-checker-v1'
  }];
  const receipt = assess(item);
  assert.equal(receipt.status, 'CONTRADICTED');
});

test('unverified or unsafe source records are rejected and cannot earn a verdict', () => {
  const item = input();
  item.evidence = [
    { ...source('UNVERIFIED', 'SUPPORTS'), admission_status: 'UNVERIFIED' },
    { ...source('INSECURE', 'SUPPORTS'), source_url: 'http://insecure.example.org/data' }
  ];
  item.deterministic_checks = [];
  const receipt = assess(item);
  assert.equal(receipt.status, 'UNVERIFIED');
  assert.equal(receipt.source_summary.admitted_evidence_count, 0);
  assert.equal(receipt.source_summary.rejected_evidence_count, 2);
});

test('model agreement without admitted source evidence is UNVERIFIED', () => {
  const item = input();
  item.evidence = [];
  item.deterministic_checks = [];
  item.model_opinions = [
    { model_id: 'scout', verdict: 'VERIFIED' },
    { model_id: 'critic', verdict: 'VERIFIED' },
    { model_id: 'vision', verdict: 'VERIFIED' }
  ];
  assert.equal(assess(item).status, 'UNVERIFIED');
});

test('calibrated confidence is included only with a validated calibration record', () => {
  const item = input();
  item.calibration = { status: 'DRAFT', confidence: 0.95 };
  assert.equal(assess(item).confidence, null);
  item.calibration = { status: 'VALIDATED', confidence: 0.91, record_ref: 'calibration-set-2026Q3' };
  const receipt = assess(item);
  assert.equal(receipt.confidence, 0.91);
  assert.equal(receipt.calibration_ref, 'calibration-set-2026Q3');
});

test('Ed25519 signature verifies the exact receipt and fails after tampering', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const signed = signReceipt(assess(input()), privatePem, 'test-key');
  assert.equal(verifySignedReceipt(signed, publicPem), true);
  const tampered = structuredClone(signed);
  tampered.receipt.status = 'VERIFIED_WITH_CERTAINTY';
  assert.equal(verifySignedReceipt(tampered, publicPem), false);
});

test('wrong signing key type fails closed', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(
    () => signReceipt(assess(input()), privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), 'rsa-key'),
    /ED25519_PRIVATE_KEY_REQUIRED/
  );
});

test('evidence is rejected if the admission signature is missing, unknown or modified', () => {
  const item = input();
  item.evidence[0].excerpt = 'edited after admission';
  const receipt = assess(item);
  assert.equal(receipt.status, 'UNVERIFIED');
  assert.equal(receipt.source_summary.admitted_evidence_count, 1);
  assert.equal(receipt.source_summary.rejected_evidence_count, 1);
});

test('caller-supplied VERIFIED labels without a trusted attestation are not evidence', () => {
  const item = input();
  const receipt = assessClaim(item, contract, { trustedEvidenceKeys: {} });
  assert.equal(receipt.status, 'UNVERIFIED');
  assert.equal(receipt.source_summary.admitted_evidence_count, 0);
  assert.equal(receipt.source_summary.rejected_evidence_count, 2);
});
