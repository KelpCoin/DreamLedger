'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = process.env.PROOF_DATA_DIR || 'D:\\BrownEyeCortex\\Proof\\Fossils';
const REQUIRED_GATES = [
  'transaction_present',
  'payment_verified',
  'attribution_verified',
  'fulfillment_verified',
  'independent_proof_verified'
];

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value), 'utf8').digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hasVerifiedEvidence(input) {
  const results = input.verification_results;
  return Boolean(
    results &&
    REQUIRED_GATES.every(gate => results[gate] === true) &&
    typeof input.external_evidence_ref === 'string' &&
    input.external_evidence_ref.trim() &&
    typeof input.verifier_id === 'string' &&
    input.verifier_id.trim()
  );
}

function writeFossil(input, outputDir = DEFAULT_ROOT) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('fossil_input_object_required');
  }
  const transactionId = String(input.transaction_id || '').trim();
  if (!transactionId) throw new Error('transaction_id is required');

  const amountValue = input.amount_total !== undefined ? input.amount_total : input.amount;
  const amount = Number(amountValue);
  const currency = String(input.currency || '').trim().toLowerCase();
  const evidenceComplete = hasVerifiedEvidence(input);
  const timestamp = input.timestamp_utc || new Date().toISOString();
  const fossil = {
    schema_version: 'BEC-FOSSIL-2.0',
    event: String(input.event || 'UNCLASSIFIED_EXTERNAL_EVENT'),
    asset_id: input.asset_id || input.product_id || input.offer_id || null,
    status: evidenceComplete && Number.isFinite(amount) && amount > 0 && /^[a-z]{3}$/.test(currency)
      ? 'PASS'
      : 'UNVERIFIED',
    verification_boundary: 'UPSTREAM_TRUSTED_VERIFIER_REQUIRED',
    ledger_head_hash: input.ledger_head_hash || null,
    verification_results: Object.fromEntries(REQUIRED_GATES.map(gate => [
      gate, Boolean(input.verification_results && input.verification_results[gate] === true)
    ])),
    verifier_id: typeof input.verifier_id === 'string' && input.verifier_id.trim() ? input.verifier_id.trim() : null,
    external_evidence_ref: typeof input.external_evidence_ref === 'string' && input.external_evidence_ref.trim()
      ? input.external_evidence_ref.trim() : null,
    idempotency_key: String(input.idempotency_key || 'fossil-' + transactionId),
    transaction_id: transactionId,
    amount: Number.isFinite(amount) ? amount : null,
    currency: /^[a-z]{3}$/.test(currency) ? currency : null,
    timestamp_utc: timestamp
  };

  const safeAsset = String(fossil.asset_id || 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '_');
  const safeTransaction = transactionId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || sha256(transactionId).slice(0, 16);
  const file = path.join(outputDir, safeAsset + '_' + safeTransaction + '_PAYMENT_PROOF.json');

  ensureDir(outputDir);
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (existing.transaction_id !== transactionId || existing.idempotency_key !== fossil.idempotency_key) {
      throw new Error('fossil_idempotency_conflict');
    }
    return { file, fossil: existing, idempotent: true };
  }

  fossil.fossil_sha256 = 'sha256:' + sha256(fossil);
  fs.writeFileSync(file, JSON.stringify(fossil, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return { file, fossil, idempotent: false };
}

function verifyFossil(file) {
  const fossil = JSON.parse(fs.readFileSync(file, 'utf8'));
  const body = { ...fossil };
  const storedHash = body.fossil_sha256;
  delete body.fossil_sha256;
  const gates = fossil.verification_results || {};
  const checks = {
    schema: fossil.schema_version === 'BEC-FOSSIL-2.0',
    transaction_id: typeof fossil.transaction_id === 'string' && fossil.transaction_id.length > 0,
    amount_positive: Number.isFinite(Number(fossil.amount)) && Number(fossil.amount) > 0,
    currency_valid: typeof fossil.currency === 'string' && /^[a-z]{3}$/.test(fossil.currency),
    timestamp: typeof fossil.timestamp_utc === 'string' && !Number.isNaN(Date.parse(fossil.timestamp_utc)),
    evidence_reference: typeof fossil.external_evidence_ref === 'string' && fossil.external_evidence_ref.trim().length > 0,
    verifier_identity: typeof fossil.verifier_id === 'string' && fossil.verifier_id.trim().length > 0,
    required_gates: REQUIRED_GATES.every(gate => gates[gate] === true),
    fossil_integrity: typeof storedHash === 'string' && storedHash === 'sha256:' + sha256(body),
    status_consistent: fossil.status === 'PASS'
      ? REQUIRED_GATES.every(gate => gates[gate] === true) &&
        Boolean(fossil.external_evidence_ref) && Boolean(fossil.verifier_id) &&
        Number(fossil.amount) > 0 && /^[a-z]{3}$/.test(String(fossil.currency))
      : fossil.status === 'UNVERIFIED'
  };
  return { status: Object.values(checks).every(Boolean) && fossil.status === 'PASS' ? 'PASS' : 'UNVERIFIED', checks, file };
}

module.exports = { writeFossil, verifyFossil, REQUIRED_GATES, sha256 };
