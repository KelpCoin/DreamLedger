'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  meterInferenceCharge,
  deliveryReceipt,
  advanceAsyncTask,
  verifyDeliveryHash,
  MAX_REVISIONS
} = require('./BridgeSettlementModels');

const TX1 = '0x' + '1'.repeat(64);
const TX2 = '0x' + '2'.repeat(64);
const TX3 = '0x' + '3'.repeat(64);
const TX4 = '0x' + '4'.repeat(64);
const digest = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

test('upto meter uses the stated rate: 100 tokens is $0.01, not $0.09', () => {
  const charge = meterInferenceCharge(100);
  assert.equal(charge.scheme, 'upto');
  assert.equal(charge.max_price_usdc, '0.10');
  assert.equal(charge.charge_atomic, '10000');
  assert.equal(charge.charge_usdc, '0.010000');
  assert.equal(charge.capped, false);
});

test('upto meter: 900 tokens is $0.09', () => {
  assert.equal(meterInferenceCharge(900).charge_usdc, '0.090000');
});

test('upto meter never exceeds $0.10', () => {
  const charge = meterInferenceCharge(25000);
  assert.equal(charge.charge_atomic, '100000');
  assert.equal(charge.charge_usdc, '0.100000');
  assert.equal(charge.capped, true);
});

test('upto meter rejects invalid usage numbers', () => {
  assert.throws(() => meterInferenceCharge(-1), /non-negative/);
  assert.throws(() => meterInferenceCharge(1.2), /safe integer/);
});

test('delivery receipt hashes the exact response bytes', () => {
  const payload = '{"ok":true,"text":"hello"}';
  const receipt = deliveryReceipt(payload, { tool: 'metered_inference', task_id: 'task-1' });
  assert.equal(receipt.payload_sha256, digest(payload));
  assert.equal(receipt.payload_bytes, Buffer.byteLength(payload, 'utf8'));
  assert.equal(verifyDeliveryHash(payload, receipt.payload_sha256), true);
  assert.equal(verifyDeliveryHash(payload + 'x', receipt.payload_sha256), false);
  assert.equal(receipt.revenue_recognized, false);
});

test('async task cannot queue without a funding transaction', () => {
  assert.throws(() => advanceAsyncTask({ state: 'FUNDED' }, 'QUEUE'), /must be funded/);
});

test('async task requires escrow funding and reviewer approval before release', () => {
  let task = { task_id: 'task-1', state: 'CREATED', revision_count: 0 };
  task = advanceAsyncTask(task, 'FUND', { escrow_fund_tx_hash: TX1 });
  task = advanceAsyncTask(task, 'QUEUE');
  task = advanceAsyncTask(task, 'START');
  task = advanceAsyncTask(task, 'SUBMIT', { delivery_sha256: digest('deliverable') });
  assert.throws(() => advanceAsyncTask(task, 'RELEASE', { escrow_release_tx_hash: TX2 }), /invalid task transition/);
  task = advanceAsyncTask(task, 'APPROVE', { reviewer_id: 'reviewer-independent', review_sha256: digest('review') });
  task = advanceAsyncTask(task, 'RELEASE', { escrow_release_tx_hash: TX2 });
  assert.equal(task.state, 'RELEASED');
  assert.equal(task.escrow_release_tx_hash, TX2);
});

test('async task allows five revisions, then requires refund after next rejection', () => {
  let task = { task_id: 'task-2', state: 'CREATED', revision_count: 0 };
  task = advanceAsyncTask(task, 'FUND', { escrow_fund_tx_hash: TX1 });
  task = advanceAsyncTask(task, 'QUEUE');
  for (let i = 0; i < MAX_REVISIONS; i++) {
    task = advanceAsyncTask(task, 'START');
    task = advanceAsyncTask(task, 'SUBMIT', { delivery_sha256: digest('draft-' + i) });
    task = advanceAsyncTask(task, 'REJECT', { feedback_sha256: digest('feedback-' + i) });
    assert.equal(task.state, 'REVISION_REQUESTED');
    task = advanceAsyncTask(task, 'RESUME');
  }
  task = advanceAsyncTask(task, 'SUBMIT', { delivery_sha256: digest('final-rejected-draft') });
  task = advanceAsyncTask(task, 'REJECT');
  assert.equal(task.state, 'REFUND_PENDING');
  task = advanceAsyncTask(task, 'REFUND', { escrow_refund_tx_hash: TX3 });
  assert.equal(task.state, 'REFUNDED');
  assert.equal(task.escrow_refund_tx_hash, TX3);
});

test('task failure after funding requires a refund state, not an implicit release', () => {
  let task = { task_id: 'task-3', state: 'CREATED' };
  task = advanceAsyncTask(task, 'FUND', { escrow_fund_tx_hash: TX1 });
  task = advanceAsyncTask(task, 'QUEUE');
  task = advanceAsyncTask(task, 'FAIL', { failure_code: 'WORKER_TIMEOUT' });
  assert.equal(task.state, 'REFUND_PENDING');
  assert.throws(() => advanceAsyncTask(task, 'RELEASE', { escrow_release_tx_hash: TX4 }), /invalid task transition/);
});
