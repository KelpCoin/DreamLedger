import test from 'node:test';
import assert from 'node:assert/strict';
import { disclosureFrameForTier, assertPolicyFrame, issueEvidenceSdJwt, presentEvidenceSdJwt, verifyEvidenceSdJwt, NEVER_DISCLOSABLE } from './BrownEyeEvidenceSdJwt.mjs';

const evidence = {
  event_id: 'EVT_TEST_SDJWT_001',
  event_type: 'TEST_EVIDENCE',
  observed_at: '2026-09-22T00:00:00Z',
  truth_status: 'TEST',
  schema_version: '1.0.0',
  sanitized_summary: 'deterministic test evidence',
  category: 'test',
  coarse_outcome: 'pass',
  provenance: 'TEST_FIXTURE',
  source_class: 'TEST',
  verification_method: 'DETERMINISTIC',
  evidence_version: '1',
  detailed_transition_data: { amount_nzd: 29 },
  richer_provenance: { source: 'TEST_FIXTURE' },
  timestamps: { observed_at: '2026-09-22T00:00:00Z' },
  actionable_intelligence: 'TEST_ONLY',
  verification_chain: ['TEST'],
  correlated_evidence: [],
  counterevidence: [],
  detailed_economic_signals: { payment: false },
  raw_receipts: 'MUST_NOT_APPEAR',
  pii: 'MUST_NOT_APPEAR',
  credentials: 'MUST_NOT_APPEAR',
  private_silo_material: 'MUST_NOT_APPEAR',
  secrets: 'MUST_NOT_APPEAR'
};

test('1/12 public frame contains no restricted material', () => {
  const frame = disclosureFrameForTier('PUBLIC');
  assert.deepEqual(frame._sd, []);
  assert.ok(NEVER_DISCLOSABLE.every(k => !frame._sd.includes(k)));
});

test('2/12 restricted claims are never selectively disclosed', () => {
  for (const tier of ['FREE','AUTHENTICATED','PAID','HIGH_VALUE','RESTRICTED']) {
    assert.ok(NEVER_DISCLOSABLE.every(k => !disclosureFrameForTier(tier)._sd.includes(k)));
  }
});

test('3/12 frame is exactly policy-derived', () => {
  assert.doesNotThrow(() => assertPolicyFrame('PAID', disclosureFrameForTier('PAID')));
});

test('4/12 security-critical claims cannot be selectively disclosed', () => {
  assert.throws(() => assertPolicyFrame('PUBLIC', {_sd:['exp']}), /SECURITY_CRITICAL/);
});

test('5/12 issuer signature verifies', async () => {
  const { credential, sdjwt } = await issueEvidenceSdJwt(evidence, 'PAID', { now: 1790035200, ttl: 300 });
  const result = await verifyEvidenceSdJwt(sdjwt, credential);
  assert.equal(result.payload.event_id, evidence.event_id);
});

test('6/12 selective presentation verifies and reconstructs disclosed claims', async () => {
  const { credential, sdjwt } = await issueEvidenceSdJwt(evidence, 'PAID', { now: 1790035200, ttl: 300 });
  const presentation = await presentEvidenceSdJwt(sdjwt, credential, 'PAID');
  const result = await verifyEvidenceSdJwt(sdjwt, presentation);
  assert.equal(result.payload.detailed_transition_data.amount_nzd, 29);
});

test('7/12 presentation does not expose restricted material', async () => {
  const { credential, sdjwt } = await issueEvidenceSdJwt(evidence, 'HIGH_VALUE', { now: 1790035200, ttl: 300 });
  const presentation = await presentEvidenceSdJwt(sdjwt, credential, 'HIGH_VALUE');
  const result = await verifyEvidenceSdJwt(sdjwt, presentation);
  for (const key of NEVER_DISCLOSABLE) assert.equal(result.payload[key], undefined);
});

test('8/12 tampered presentation is rejected', async () => {
  const { credential, sdjwt } = await issueEvidenceSdJwt(evidence, 'PAID', { now: 1790035200, ttl: 300 });
  const presentation = await presentEvidenceSdJwt(sdjwt, credential, 'PAID');
  const parts = presentation.split('~');
  parts[0] = parts[0].slice(0,-1) + (parts[0].endsWith('A') ? 'B' : 'A');
  await assert.rejects(() => verifyEvidenceSdJwt(sdjwt, parts.join('~')));
});

test('9/12 unreferenced disclosure is rejected by the library', async () => {
  const { credential, sdjwt } = await issueEvidenceSdJwt(evidence, 'FREE', { now: 1790035200, ttl: 300 });
  const presentation = credential + '~' + Buffer.from(JSON.stringify(['extra-salt','category','extra'])).toString('base64url');
  await assert.rejects(() => verifyEvidenceSdJwt(sdjwt, presentation));
});

test('10/12 claim collision policy is explicit', () => {
  assert.throws(() => assertPolicyFrame('PAID', {_sd:['iss']}), /SECURITY_CRITICAL/);
});

test('11/12 expired credentials are rejected', async () => {
  const { credential, sdjwt } = await issueEvidenceSdJwt(evidence, 'FREE', { now: 1000, ttl: 1 });
  await assert.rejects(() => verifyEvidenceSdJwt(sdjwt, credential), /expired|JWT_EXPIRED/i);
});

test('12/12 access tier changes the disclosure frame', () => {
  assert.equal(disclosureFrameForTier('PUBLIC')._sd.length, 0);
  assert.ok(disclosureFrameForTier('PAID')._sd.includes('detailed_transition_data'));
  assert.ok(!disclosureFrameForTier('PAID')._sd.includes('raw_receipts'));
});
