import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAtomicAmount, parseTransferData, assertExactAmount, settledPaymentPatch, MalformedAmountError } from './settlement-guards.mjs';

test('USDC base units are correct: 0.10 USDC is 100000, not 1000000', () => {
  assert.equal(parseAtomicAmount('100000'), 100_000n);
  assert.equal(parseAtomicAmount('1000000'), 1_000_000n);
  assert.equal(parseTransferData('0x186a0'), 100_000n);
  assertExactAmount(parseTransferData('0x186a0'), parseAtomicAmount('100000'));
});

test('no decimal ambiguity, empty amount, float, negative or unsafe JS number accepted', () => {
  for (const invalid of ['', ' ', '-1', '0.1', 'NaN', 100000, null, undefined, '+100', '01', '1e5']) {
    assert.throws(() => parseAtomicAmount(invalid), MalformedAmountError);
  }
  for (const invalid of ['', '0x', '0x1.2', '0xpotato', 100000, null]) {
    assert.throws(() => parseTransferData(invalid), MalformedAmountError);
  }
});

test('exact scheme rejects underpayments, zero and overpayments', () => {
  const requested = parseAtomicAmount('100000');
  assert.throws(() => assertExactAmount(0n, requested), /X402_AMOUNT_NOT_EXACT/);
  assert.throws(() => assertExactAmount(99_999n, requested), /X402_AMOUNT_NOT_EXACT/);
  assert.throws(() => assertExactAmount(100_001n, requested), /X402_AMOUNT_NOT_EXACT/);
  assert.throws(() => assertExactAmount(0n, 0n), /X402_AMOUNT_NOT_EXACT/);
});

const evidence = {
  metadata: { preexisting: 'kept', scoreboard_eligible: true, delivery_verified: true },
  network: 'eip155:8453', txHash: '0x' + 'a'.repeat(64), tollCallId: 'call-123',
  block: 123456, confirmations: 3, amountNzd: 0.164,
  fx: { rate: 1.64, source: 'ECB/Frankfurter', observed_at: '2026-10-26T00:00:00Z' }
};
test('settlement does not imply delivered or verified commercial revenue', () => {
  const patch = settledPaymentPatch(evidence);
  assert.equal(patch.payment_settled, true);
  assert.equal(patch.metadata.delivery_verified, false);
  assert.equal(patch.metadata.scoreboard_eligible, false);
  assert.equal(patch.metadata.preexisting, 'kept');
  assert.equal(Object.hasOwn(patch, 'verification_status'), false);
  assert.equal(Object.hasOwn(patch, 'verification_state'), false);
  assert.equal(Object.hasOwn(patch, 'state_after'), false);
});
test('unsupported networks, missing payments and insufficient confirmations fail closed', () => {
  assert.throws(() => settledPaymentPatch({ ...evidence, network: 'eip155:1' }), /X402_NETWORK_UNSUPPORTED/);
  assert.throws(() => settledPaymentPatch({ ...evidence, confirmations: 2 }), /X402_CONFIRMATIONS_INVALID/);
  assert.throws(() => settledPaymentPatch({ ...evidence, amountNzd: 0 }), /X402_PAYMENT_CONTEXT_INVALID/);
  assert.throws(() => settledPaymentPatch({ ...evidence, txHash: 'fake' }), /X402_TX_INVALID/);
});
