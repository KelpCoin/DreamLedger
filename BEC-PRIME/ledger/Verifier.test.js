'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFossil, verifyFossil, REQUIRED_GATES } = require('./Verifier');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'beck-fossil-test-'));
}

function validInput(overrides = {}) {
  return {
    transaction_id: 'pi_external_123',
    idempotency_key: 'fossil-pi_external_123',
    asset_id: 'TOLL-PROBE-50C',
    event: 'provider.settlement.verified',
    amount: 0.5,
    currency: 'nzd',
    timestamp_utc: '2026-10-11T10:00:00.000Z',
    external_evidence_ref: 'provider-reconciliation:evt_123',
    verifier_id: 'trusted-stripe-reconciler/v1',
    verification_results: Object.fromEntries(REQUIRED_GATES.map(gate => [gate, true])),
    ...overrides
  };
}

test('missing trusted evidence never becomes PASS by default', () => {
  const dir = tempDir();
  try {
    const { file, fossil } = writeFossil({ transaction_id: 'pi_unknown', amount: 0.5, currency: 'nzd' }, dir);
    assert.equal(fossil.status, 'UNVERIFIED');
    assert.equal(verifyFossil(file).status, 'UNVERIFIED');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('only complete evidence envelope passes and fossil tampering is detected', () => {
  const dir = tempDir();
  try {
    const { file, fossil } = writeFossil(validInput(), dir);
    assert.equal(fossil.status, 'PASS');
    assert.equal(verifyFossil(file).status, 'PASS');
    const changed = JSON.parse(fs.readFileSync(file, 'utf8'));
    changed.amount = 49;
    fs.writeFileSync(file, JSON.stringify(changed));
    const result = verifyFossil(file);
    assert.equal(result.status, 'UNVERIFIED');
    assert.equal(result.checks.fossil_integrity, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing fulfillment or independent proof blocks PASS', () => {
  const dir = tempDir();
  try {
    const gates = Object.fromEntries(REQUIRED_GATES.map(gate => [gate, true]));
    gates.fulfillment_verified = false;
    const { file, fossil } = writeFossil(validInput({ verification_results: gates }), dir);
    assert.equal(fossil.status, 'UNVERIFIED');
    assert.equal(verifyFossil(file).status, 'UNVERIFIED');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects conflicting duplicate transaction identity', () => {
  const dir = tempDir();
  try {
    writeFossil(validInput(), dir);
    assert.throws(
      () => writeFossil(validInput({ amount: 49 }), dir),
      /fossil_idempotency_conflict/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
