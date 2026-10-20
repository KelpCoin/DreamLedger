'use strict';

const crypto = require('crypto');

const USDC_ATOMIC_UNITS = 1000000n;
const DEFAULT_MAX_USDC_ATOMIC = 100000n; // $0.10
const DEFAULT_RATE_ATOMIC_PER_TOKEN = 100n; // $0.0001 per generated token
const MAX_REVISIONS = 5;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function meterInferenceCharge(tokensGenerated, options = {}) {
  if (!Number.isSafeInteger(tokensGenerated) || tokensGenerated < 0) {
    throw new TypeError('tokensGenerated must be a non-negative safe integer');
  }
  const rate = BigInt(options.rateAtomicPerToken === undefined ? DEFAULT_RATE_ATOMIC_PER_TOKEN : options.rateAtomicPerToken);
  const cap = BigInt(options.capAtomic === undefined ? DEFAULT_MAX_USDC_ATOMIC : options.capAtomic);
  if (rate < 0n || cap < 0n) throw new RangeError('rate and cap must be non-negative');
  const calculated = BigInt(tokensGenerated) * rate;
  const atomic = calculated > cap ? cap : calculated;
  return {
    scheme: 'upto',
    max_price_usdc: '0.10',
    charge_atomic: atomic.toString(),
    charge_usdc: (Number(atomic) / Number(USDC_ATOMIC_UNITS)).toFixed(6),
    tokens_generated: tokensGenerated,
    capped: calculated > cap
  };
}

function deliveryReceipt(payload, metadata = {}) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  return {
    schema: 'dreamledger/agent-bridge-delivery-receipt/v1',
    tool: String(metadata.tool || 'unknown'),
    task_id: metadata.task_id ? String(metadata.task_id) : null,
    payload_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    payload_bytes: bytes.length,
    delivered_at: metadata.delivered_at || null,
    settlement_tx_hash: metadata.settlement_tx_hash || null,
    settlement_finality: metadata.settlement_finality || 'NOT_VERIFIED',
    revenue_recognized: false
  };
}

const TRANSITIONS = Object.freeze({
  CREATED: new Set(['FUND']),
  FUNDED: new Set(['QUEUE']),
  QUEUED: new Set(['START', 'FAIL']),
  RUNNING: new Set(['SUBMIT', 'FAIL']),
  SUBMITTED: new Set(['APPROVE', 'REJECT']),
  REVISION_REQUESTED: new Set(['RESUME']),
  APPROVED: new Set(['RELEASE']),
  REFUND_PENDING: new Set(['REFUND']),
  RELEASED: new Set([]),
  REFUNDED: new Set([]),
  FAILED: new Set([])
});

function requireHash(value, label) {
  if (typeof value !== 'string' || !TX_HASH_RE.test(value)) {
    throw new TypeError(label + ' must be a 32-byte transaction hash');
  }
}

function advanceAsyncTask(task, action, evidence = {}) {
  if (!task || typeof task !== 'object' || !TRANSITIONS[task.state]) {
    throw new TypeError('task has an invalid state');
  }
  if (!TRANSITIONS[task.state].has(action)) {
    throw new Error('invalid task transition: ' + task.state + ' -> ' + action);
  }
  const next = Object.assign({}, task);
  switch (action) {
    case 'FUND':
      requireHash(evidence.escrow_fund_tx_hash, 'escrow_fund_tx_hash');
      next.escrow_fund_tx_hash = evidence.escrow_fund_tx_hash;
      next.state = 'FUNDED';
      break;
    case 'QUEUE':
      if (!next.escrow_fund_tx_hash) throw new Error('escrow must be funded before queueing');
      next.state = 'QUEUED';
      break;
    case 'START':
      next.state = 'RUNNING';
      break;
    case 'SUBMIT':
      if (typeof evidence.delivery_sha256 !== 'string' || !SHA256_RE.test(evidence.delivery_sha256)) {
        throw new TypeError('delivery_sha256 must be a lowercase SHA-256 digest');
      }
      next.delivery_sha256 = evidence.delivery_sha256;
      next.submitted_at = evidence.submitted_at || null;
      next.state = 'SUBMITTED';
      break;
    case 'APPROVE':
      if (!evidence.reviewer_id || typeof evidence.review_sha256 !== 'string' || !SHA256_RE.test(evidence.review_sha256)) {
        throw new Error('independent reviewer_id and review_sha256 are required');
      }
      next.reviewer_id = String(evidence.reviewer_id);
      next.review_sha256 = evidence.review_sha256;
      next.approved_at = evidence.approved_at || null;
      next.state = 'APPROVED';
      break;
    case 'REJECT': {
      const revisions = Number.isInteger(next.revision_count) && next.revision_count >= 0 ? next.revision_count : 0;
      if (revisions >= MAX_REVISIONS) {
        next.state = 'REFUND_PENDING';
        next.refund_reason = 'MAX_REVISIONS_EXHAUSTED';
      } else {
        next.revision_count = revisions + 1;
        next.revision_feedback_sha256 = evidence.feedback_sha256 && SHA256_RE.test(evidence.feedback_sha256)
          ? evidence.feedback_sha256 : null;
        next.state = 'REVISION_REQUESTED';
      }
      break;
    }
    case 'RESUME':
      next.state = 'RUNNING';
      break;
    case 'RELEASE':
      if (task.state !== 'APPROVED' || !next.escrow_fund_tx_hash || !next.delivery_sha256 || !next.review_sha256) {
        throw new Error('verified funding, delivery, and evaluator approval are required before release');
      }
      requireHash(evidence.escrow_release_tx_hash, 'escrow_release_tx_hash');
      next.escrow_release_tx_hash = evidence.escrow_release_tx_hash;
      next.state = 'RELEASED';
      break;
    case 'REFUND':
      if (task.state !== 'REFUND_PENDING' && task.state !== 'FAILED') {
        throw new Error('refund requires a failed task or exhausted revisions');
      }
      requireHash(evidence.escrow_refund_tx_hash, 'escrow_refund_tx_hash');
      next.escrow_refund_tx_hash = evidence.escrow_refund_tx_hash;
      next.state = 'REFUNDED';
      break;
    case 'FAIL':
      next.state = next.escrow_fund_tx_hash ? 'REFUND_PENDING' : 'FAILED';
      next.failure_code = String(evidence.failure_code || 'TASK_FAILED');
      break;
    default:
      throw new Error('unknown action');
  }
  return next;
}

function verifyDeliveryHash(payload, expectedSha256) {
  if (typeof expectedSha256 !== 'string' || !SHA256_RE.test(expectedSha256)) return false;
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex') === expectedSha256;
}

module.exports = {
  meterInferenceCharge,
  deliveryReceipt,
  advanceAsyncTask,
  verifyDeliveryHash,
  MAX_REVISIONS,
  USDC_ATOMIC_UNITS
};
