'use strict';

const crypto = require('crypto');

const SCHEMA = 'dreamledger/trust-attestation/v1';

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  return '{' + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ':' + canonicalize(value[key]);
  }).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalEvidence(evidence) {
  return canonicalize(evidence);
}

function evidenceHash(evidence) {
  return sha256(canonicalEvidence(evidence));
}

function signHash(hash) {
  const privateKey = process.env.TRUST_ATTESTATION_PRIVATE_KEY_PEM || '';
  if (!privateKey) return null;
  return crypto.sign(null, Buffer.from(hash, 'utf8'), privateKey).toString('base64url');
}

function verifySignature(hash, signature) {
  const publicKey = process.env.TRUST_ATTESTATION_PUBLIC_KEY_PEM || '';
  if (!publicKey || !signature) return false;
  try {
    return crypto.verify(null, Buffer.from(hash, 'utf8'), publicKey, Buffer.from(signature, 'base64url'));
  } catch (_) {
    return false;
  }
}

function assess(evidence) {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, status: ok ? 'PASS' : 'FAIL', detail: detail });
  }

  check('SCHEMA', evidence && evidence.schema === SCHEMA, 'schema=' + (evidence && evidence.schema));
  check('TRANSACTION_ID', !!(evidence && evidence.transaction_id), 'transaction_id=' + (evidence && evidence.transaction_id));
  check('SOURCE_REFERENCE', !!(evidence && evidence.source_reference), 'source_reference=' + (evidence && evidence.source_reference));
  check('OBSERVED_AT', !!(evidence && evidence.observed_at), 'observed_at=' + (evidence && evidence.observed_at));
  check('PAYMENT_EVENT_ID', !!(evidence && evidence.payment_event_id), 'payment_event_id=' + (evidence && evidence.payment_event_id));
  check('PAYMENT_STATUS', evidence && evidence.payment_status === 'paid', 'payment_status=' + (evidence && evidence.payment_status));

  const suppliedHash = evidence && evidence.evidence_hash;
  const unsigned = Object.assign({}, evidence || {});
  delete unsigned.evidence_hash;
  delete unsigned.signature;
  const calculatedHash = evidenceHash(unsigned);
  check('EVIDENCE_HASH', !!suppliedHash && suppliedHash === calculatedHash, 'expected=' + calculatedHash + ' supplied=' + suppliedHash);

  let signatureStatus = 'INSUFFICIENT_EVIDENCE';
  if (evidence && evidence.signature) {
    signatureStatus = verifySignature(calculatedHash, evidence.signature) ? 'PASS' : 'FAIL';
  }
  checks.push({ name: 'SIGNATURE', status: signatureStatus, detail: 'Ed25519 signature verification' });

  const hardFail = checks.some(function (c) { return c.status === 'FAIL'; });
  const missingExternalEvidence = !evidence || !evidence.payment_event_id || evidence.payment_status !== 'paid' || !evidence.signature;
  const status = hardFail ? 'FAIL' : (missingExternalEvidence ? 'INSUFFICIENT_EVIDENCE' : 'PASS');

  return { status: status, checks: checks, calculated_hash: calculatedHash };
}

function buildAttestation(evidence) {
  const unsigned = Object.assign({}, evidence, { schema: SCHEMA });
  delete unsigned.evidence_hash;
  delete unsigned.signature;
  const hash = evidenceHash(unsigned);
  const signature = signHash(hash);
  const normalized = Object.assign({}, unsigned, { evidence_hash: hash });
  if (signature) normalized.signature = signature;
  const assessment = assess(normalized);
  return {
    type: 'dreamledger-trust-attestation',
    version: 1,
    status: assessment.status,
    evidence: normalized,
    verification: assessment,
    generated_at: new Date().toISOString()
  };
}

module.exports = { SCHEMA, canonicalize, evidenceHash, buildAttestation, assess };
