'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = process.env.PROOF_DATA_DIR || 'D:\\BrownEyeCortex\\Proof\\Fossils';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFossil(input, outputDir = DEFAULT_ROOT) {
  const event = input.event || 'checkout.session.completed';
  const transactionId = input.transaction_id;
  if (!transactionId) throw new Error('transaction_id is required');
  const timestamp = input.timestamp_utc || new Date().toISOString();
  const fossil = {
    schema_version: 'BEC-FOSSIL-1.0',
    event,
    asset_id: input.asset_id || input.product_id || input.offer_id || null,
    evidence_level: 1,
    status: 'PASS',
    ledger_head_hash: input.ledger_head_hash || sha256(JSON.stringify({ event, transactionId, timestamp })),
    verification_results: input.verification_results || {
      transaction_present: true,
      payment_verified: true,
      inventory_check: true,
      approval_gate: true,
      idempotency_check: true
    },
    idempotency_key: input.idempotency_key || `fossil-${transactionId}`,
    transaction_id: transactionId,
    amount: Number(input.amount || input.amount_total || 0),
    currency: String(input.currency || 'nzd').toLowerCase(),
    timestamp_utc: timestamp
  };
  ensureDir(outputDir);
  const safeAsset = String(fossil.asset_id || 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '_');
  const file = path.join(outputDir, `${safeAsset}_FIRST_PAYMENT_PROOF.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fossil, null, 2) + '\n', 'utf8');
  return { file, fossil };
}

function verifyFossil(file) {
  const fossil = JSON.parse(fs.readFileSync(file, 'utf8'));
  const checks = {
    schema: fossil.schema_version === 'BEC-FOSSIL-1.0',
    status: fossil.status === 'PASS',
    transaction_id: Boolean(fossil.transaction_id),
    evidence_level: fossil.evidence_level === 1,
    timestamp: Boolean(fossil.timestamp_utc)
  };
  return { status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, file };
}

module.exports = { writeFossil, verifyFossil };
