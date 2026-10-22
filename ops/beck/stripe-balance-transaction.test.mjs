import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStripeBalanceTransaction } from '../../supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/shared/stripe-balance-transaction.mjs';

const session = {
  id: 'cs_fixture123',
  payment_intent: 'pi_fixture123',
  livemode: true,
  status: 'complete',
  payment_status: 'paid',
  amount_total: 1500,
  currency: 'nzd',
};
const paymentIntent = {
  id: 'pi_fixture123',
  livemode: true,
  status: 'succeeded',
  amount_received: 1500,
  currency: 'nzd',
  latest_charge: {
    id: 'ch_fixture123',
    livemode: true,
    amount_captured: 1500,
    currency: 'nzd',
    balance_transaction: {
      id: 'txn_fixture123',
      amount: 1500,
      fee: 45,
      net: 1455,
      currency: 'nzd',
      fee_details: [{ type: 'stripe_fee', description: 'processing', amount: 45, currency: 'nzd' }],
    },
  },
};

test('complete live Checkout and balance transaction produces provider fee evidence', () => {
  const r = validateStripeBalanceTransaction({ session, paymentIntent });
  assert.equal(r.state, 'SETTLED_AND_DETAILED');
  assert.equal(r.source, 'stripe_balance_transaction');
  assert.equal(r.payment_intent_id, 'pi_fixture123');
  assert.equal(r.balance_transaction_id, 'txn_fixture123');
  assert.equal(r.amount_minor, 1500);
  assert.equal(r.fee_minor, 45);
  assert.equal(r.net_minor, 1455);
  assert.equal(r.fee_details.reduce((sum, d) => sum + d.amount_minor, 0), r.fee_minor);
});

test('test-mode events cannot enter the production settlement path', () => {
  assert.equal(validateStripeBalanceTransaction({ session: { ...session, livemode: false }, paymentIntent }).reason, 'NOT_LIVE_MODE');
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, livemode: false } }).reason, 'NOT_LIVE_MODE');
});

test('unpaid or non-complete Checkout sessions are rejected', () => {
  assert.equal(validateStripeBalanceTransaction({ session: { ...session, payment_status: 'unpaid' }, paymentIntent }).reason, 'CHECKOUT_SESSION_NOT_PAID');
  assert.equal(validateStripeBalanceTransaction({ session: { ...session, status: 'open' }, paymentIntent }).reason, 'CHECKOUT_SESSION_NOT_PAID');
});

test('payment intent identity, status, amount and currency must match session', () => {
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, id: 'pi_other' } }).reason, 'PAYMENT_INTENT_ID_MISMATCH');
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, status: 'processing' } }).reason, 'PAYMENT_INTENT_NOT_SUCCEEDED');
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, amount_received: 1499 } }).reason, 'PAYMENT_INTENT_AMOUNT_MISMATCH');
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, currency: 'usd' } }).reason, 'PAYMENT_INTENT_CURRENCY_MISMATCH');
});

test('missing expanded charge or balance transaction remains pending', () => {
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: 'ch_fixture123' } }).state, 'SETTLED_PENDING_DETAIL');
  const latest = { ...paymentIntent.latest_charge, balance_transaction: null };
  const r = validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: latest } });
  assert.equal(r.state, 'SETTLED_PENDING_DETAIL');
  assert.equal(r.reason, 'BALANCE_TRANSACTION_PENDING');
  assert.equal(r.retryable, true);
});

test('fee details are mandatory and must reconcile to balance transaction fee', () => {
  const balance = paymentIntent.latest_charge.balance_transaction;
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: { ...paymentIntent.latest_charge, balance_transaction: { ...balance, fee_details: [] } } } }).reason, 'BALANCE_TRANSACTION_FEE_DETAILS_MISSING');
  const mismatch = { ...balance, fee_details: [{ type: 'stripe_fee', amount: 44, currency: 'nzd' }] };
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: { ...paymentIntent.latest_charge, balance_transaction: mismatch } } }).reason, 'BALANCE_TRANSACTION_FEE_DETAILS_MISMATCH');
});

test('gross, fee, net, charge and currency mismatches are blocked', () => {
  const b = paymentIntent.latest_charge.balance_transaction;
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: { ...paymentIntent.latest_charge, amount_captured: 1499 } } }).reason, 'CHARGE_AMOUNT_MISMATCH');
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: { ...paymentIntent.latest_charge, balance_transaction: { ...b, amount: 1499 } } } }).reason, 'BALANCE_TRANSACTION_AMOUNT_MISMATCH');
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: { ...paymentIntent.latest_charge, balance_transaction: { ...b, net: 1400 } } } }).reason, 'BALANCE_TRANSACTION_NET_MISMATCH');
  assert.equal(validateStripeBalanceTransaction({ session, paymentIntent: { ...paymentIntent, latest_charge: { ...paymentIntent.latest_charge, balance_transaction: { ...b, currency: 'usd' } } } }).reason, 'BALANCE_TRANSACTION_CURRENCY_MISMATCH');
});
