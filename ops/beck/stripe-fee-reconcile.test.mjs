import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchStripeFeeEvidence } from './stripe-fee-reconcile.mjs';

function fakeFetch(payload, status = 200) {
  return async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.match(String(url), /expand%5B%5D=latest_charge.balance_transaction/);
    assert.ok(options.headers.Authorization.startsWith('Basic '));
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
}

const intent = {
  id: 'pi_fixture123', livemode: true, status: 'succeeded',
  latest_charge: {
    id: 'ch_fixture123', amount_captured: 1500, currency: 'nzd',
    balance_transaction: {
      id: 'txn_fixture123', type: 'charge', amount: 1500, fee: 45, net: 1455, currency: 'nzd',
      fee_details: [{ type: 'stripe_fee', description: 'processing', amount: 45, currency: 'nzd' }],
    },
  },
};

test('reads expanded balance transaction and returns fee evidence', async () => {
  const r = await fetchStripeFeeEvidence({
    paymentIntentId: 'pi_fixture123',
    secretKey: 'sk_live_fixture',
    fetchImpl: fakeFetch(intent),
  });
  assert.equal(r.state, 'SETTLED_AND_DETAILED');
  assert.equal(r.fee_minor, 45);
  assert.equal(r.net_minor, 1455);
  assert.equal(r.balance_transaction_id, 'txn_fixture123');
  assert.equal(r.livemode, true);
});

test('does not treat missing balance transaction as fee reconciliation', async () => {
  const r = await fetchStripeFeeEvidence({
    paymentIntentId: 'pi_fixture123',
    secretKey: 'sk_test_fixture',
    fetchImpl: fakeFetch({ ...intent, latest_charge: { id: 'ch_fixture123', amount_captured: 1500, currency: 'nzd', balance_transaction: null } }),
  });
  assert.equal(r.state, 'SETTLED_PENDING_DETAIL');
  assert.equal(r.reason, 'BALANCE_TRANSACTION_PENDING');
});

test('test mode payment cannot become live settlement evidence', async () => {
  const r = await fetchStripeFeeEvidence({
    paymentIntentId: 'pi_fixture123',
    secretKey: 'sk_test_fixture',
    fetchImpl: fakeFetch({ ...intent, livemode: false }),
  });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.reason, 'NOT_LIVE_MODE');
});

test('missing secret fails closed without a network request', async () => {
  const r = await fetchStripeFeeEvidence({
    paymentIntentId: 'pi_fixture123',
    secretKey: '',
    fetchImpl: async () => { throw new Error('must not be called'); },
  });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.reason, 'STRIPE_SECRET_KEY_MISSING_OR_INVALID');
});

test('missing fee breakdown cannot be reconciled', async () => {
  const bt = { ...intent.latest_charge.balance_transaction };
  delete bt.fee_details;
  const r = await fetchStripeFeeEvidence({ paymentIntentId: 'pi_fixture123', secretKey: 'sk_test_fixture',
    fetchImpl: fakeFetch({ ...intent, latest_charge: { ...intent.latest_charge, balance_transaction: bt } }) });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.reason, 'BALANCE_TRANSACTION_FEE_DETAILS_MISSING');
});

test('fee breakdown must sum to provider fee', async () => {
  const r = await fetchStripeFeeEvidence({ paymentIntentId: 'pi_fixture123', secretKey: 'sk_test_fixture',
    fetchImpl: fakeFetch({ ...intent, latest_charge: { ...intent.latest_charge, balance_transaction: {
      ...intent.latest_charge.balance_transaction, fee_details: [{ type: 'stripe_fee', amount: 44, currency: 'nzd' }],
    } } }) });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.reason, 'BALANCE_TRANSACTION_FEE_DETAILS_MISMATCH');
});

test('invalid fee fields are blocked', async () => {
  const r = await fetchStripeFeeEvidence({
    paymentIntentId: 'pi_fixture123',
    secretKey: 'sk_test_fixture',
    fetchImpl: fakeFetch({ ...intent, latest_charge: { ...intent.latest_charge, balance_transaction: { ...intent.latest_charge.balance_transaction, fee: -1 } } }),
  });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.reason, 'BALANCE_TRANSACTION_FIELDS_INVALID');
});
