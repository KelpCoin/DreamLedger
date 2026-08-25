'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'PROOF-TRUST-ATTESTATION.json');
const SCHEMA = 'dreamledger/trust-attestation/v1';

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}
function hash(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function fail(message) {
  console.error('TRUST_ATTESTATION_FAIL ' + message);
  process.exitCode = 1;
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) fail(name + ': ' + detail);
}

try {
  if (!fs.existsSync(MANIFEST)) throw new Error('Missing ' + path.relative(ROOT, MANIFEST));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  check('SCHEMA', manifest.schema === SCHEMA, 'schema=' + manifest.schema);
  check('STATE', ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE'].includes(manifest.status), 'status=' + manifest.status);
  check('EVIDENCE_OBJECT', manifest.evidence && typeof manifest.evidence === 'object', 'evidence object required');

  const evidence = Object.assign({}, manifest.evidence || {});
  const suppliedHash = evidence.evidence_hash;
  delete evidence.evidence_hash;
  delete evidence.signature;
  const calculatedHash = hash(canonicalize(evidence));
  check('EVIDENCE_HASH', suppliedHash === calculatedHash, 'expected=' + calculatedHash + ' supplied=' + suppliedHash);

  const required = ['transaction_id', 'source_reference', 'observed_at', 'payment_event_id', 'payment_status'];
  for (const field of required) check('FIELD_' + field.toUpperCase(), !!manifest.evidence[field], field + ' present');

  const paid = manifest.evidence.payment_status === 'paid';
  const hasPaymentEvent = !!manifest.evidence.payment_event_id;
  const hasSignature = !!manifest.evidence.signature;
  const expectedState = paid && hasPaymentEvent && hasSignature ? 'PASS' : 'INSUFFICIENT_EVIDENCE';
  check('STATE_CONSISTENCY', manifest.status === expectedState || (manifest.status === 'FAIL' && process.exitCode), 'expected=' + expectedState + ' actual=' + manifest.status);

  const result = {
    type: 'dreamledger-trust-attestation-verification',
    version: 1,
    status: process.exitCode ? 'FAIL' : manifest.status,
    calculated_evidence_hash: calculatedHash,
    checks
  };
  const proof = path.join(ROOT, 'PROOF-TRUST-ATTESTATION-VERIFY.json');
  fs.writeFileSync(proof, JSON.stringify(result, null, 2) + '\n');
  console.log('TRUST_ATTESTATION_' + result.status);
  if (process.exitCode) process.exit(1);
} catch (err) {
  const proof = path.join(ROOT, 'PROOF-TRUST-ATTESTATION-VERIFY.json');
  const result = { type: 'dreamledger-trust-attestation-verification', version: 1, status: 'FAIL', error: err.message, checks };
  fs.writeFileSync(proof, JSON.stringify(result, null, 2) + '\n');
  console.error('TRUST_ATTESTATION_FAIL ' + err.message);
  process.exit(1);
}
