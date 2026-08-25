'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'evidence', 'manifest.json');
const PROOF = path.join(ROOT, 'PROOF-EVIDENCE-MANIFEST-VERIFY.json');
const SCHEMA = 'dreamledger/evidence-manifest/v2';

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Text(text) {
  return sha256Bytes(Buffer.from(text, 'utf8'));
}

function b64urlToBuffer(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function fail(message) {
  checks.push({ name: 'ERROR', status: 'FAIL', detail: message });
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
}

let overall = 'FAIL';
try {
  if (!fs.existsSync(MANIFEST)) throw new Error('Missing evidence/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  check('SCHEMA', manifest.schema === SCHEMA, 'schema=' + manifest.schema);
  check('STATE_ENUM', ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE'].includes(manifest.status), 'status=' + manifest.status);
  check('FILES_ARRAY', Array.isArray(manifest.files), 'files array required');
  check('SIGNATURE_OBJECT', !!manifest.signature && typeof manifest.signature === 'object', 'signature required');

  let integrityOk = true;
  if (Array.isArray(manifest.files)) {
    for (const item of manifest.files) {
      const rel = String(item.path || '');
      const expected = String(item.sha256 || '').toLowerCase();
      const full = path.resolve(ROOT, rel);
      const insideRoot = full === ROOT || full.startsWith(ROOT + path.sep);
      if (!insideRoot || !rel || !expected) {
        integrityOk = false;
        check('FILE_ENTRY', false, 'invalid path or hash: ' + rel);
        continue;
      }
      if (!fs.existsSync(full)) {
        integrityOk = false;
        check('FILE_' + rel, false, 'missing');
        continue;
      }
      const actual = sha256Bytes(fs.readFileSync(full));
      const ok = actual === expected;
      if (!ok) integrityOk = false;
      check('FILE_' + rel, ok, 'expected=' + expected + ' actual=' + actual);
    }
  }

  const suppliedSignature = manifest.signature && manifest.signature.value;
  const jwk = manifest.signature && manifest.signature.public_key_jwk;
  const unsigned = Object.assign({}, manifest);
  delete unsigned.signature;
  const payload = Buffer.from(canonicalize(unsigned), 'utf8');
  const payloadHash = sha256Text(payload.toString('utf8'));
  check('PAYLOAD_HASH', manifest.payload_sha256 === payloadHash, 'expected=' + payloadHash + ' supplied=' + manifest.payload_sha256);

  let signatureOk = false;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    signatureOk = crypto.verify('RSA-SHA256', payload, key, b64urlToBuffer(suppliedSignature || ''));
  } catch (e) {
    signatureOk = false;
  }
  check('RSA_SIGNATURE', signatureOk, 'RSA-SHA256 signature verification');

  const payment = manifest.external_payment || {};
  const paidEvidence = payment.payment_status === 'paid' && !!payment.payment_event_id && !!payment.source_reference;
  const declaredStatus = manifest.status;
  const expectedState = !integrityOk || !signatureOk ? 'FAIL' : (paidEvidence ? 'PASS' : 'INSUFFICIENT_EVIDENCE');
  check('STATE_CONSISTENCY', declaredStatus === expectedState, 'expected=' + expectedState + ' actual=' + declaredStatus);

  overall = (!integrityOk || !signatureOk) ? 'FAIL' : expectedState;
} catch (err) {
  fail(err.message);
  overall = 'FAIL';
}

const proof = {
  type: 'dreamledger-evidence-manifest-verification',
  version: 2,
  status: overall,
  verified_at: new Date().toISOString(),
  checks
};
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log('EVIDENCE_MANIFEST_' + overall);
process.exitCode = overall === 'FAIL' ? 1 : 0;
