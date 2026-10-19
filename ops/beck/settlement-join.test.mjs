import test from 'node:test';
import assert from 'node:assert/strict';
import { joinSettlementWithProviderFee, evaluateSettlementWithStripeFetch } from './settlement-join.mjs';

const base = {
  status: 'succeeded',
  livemode: true,
  payment_intent_id: 'pi_fixture123',
  offer_id: 'offer_1',
  independent_buyer: true,
  buyer_evidence_ref: 'evidence/buyer.json',
  fulfillment_status: 'delivered',
  delivery_proof_ref: 'evidence/delivery.json',
};

const detailed = {
  state: 'SETTLED_AND_DETAILED',
  payment_intent_id: 'pi_fixture123',
  charge_id: 'ch_1',
  balance_transaction_id: 'txn_1',
  fee_minor: 45,
  net_minor: 1455,
  amount_minor: 1500,
  currency: 'nzd',
  fee_details: [{ type: 'stripe_fee', description: 'processing', amount_minor: 45, currency: 'nzd' }],
  livemode: true,
  provider: 'stripe',
};

test('SETTLED_AND_DETAILED join can PASS full chain', () => {
  const r = joinSettlementWithProviderFee(base, detailed);
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.counts_as_verified_external_revenue, true);
});

test('SETTLED_PENDING_DETAIL cannot become reconciled PASS', () => {
  const r = joinSettlementWithProviderFee(base, {
    state: 'SETTLED_PENDING_DETAIL',
    reason: 'BALANCE_TRANSACTION_PENDING',
    payment_intent_id: 'pi_fixture123',
  });
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.reason, 'FEE_DETAIL_PENDING');
  assert.equal(r.counts_as_verified_external_revenue, false);
});

test('BLOCKED adapter state cannot pass revenue', () => {
  const r = joinSettlementWithProviderFee(base, {
    state: 'BLOCKED',
    reason: 'NOT_LIVE_MODE',
  });
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.counts_as_verified_external_revenue, false);
});

test('payment_intent mismatch fails closed', () => {
  const r = joinSettlementWithProviderFee(base, {
    ...detailed,
    payment_intent_id: 'pi_other',
  });
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.reason, 'PAYMENT_INTENT_MISMATCH');
});

test('missing commercial fields still block after good fee evidence', () => {
  const r = joinSettlementWithProviderFee(
    { status: 'succeeded', livemode: true, payment_intent_id: 'pi_fixture123' },
    detailed
  );
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.counts_as_verified_external_revenue, false);
});

test('evaluateSettlementWithStripeFetch without secret stays blocked', async () => {
  const r = await evaluateSettlementWithStripeFetch(base, { secretKey: '' });
  assert.equal(r.fee_evidence_state, 'BLOCKED');
  assert.equal(r.evaluation.counts_as_verified_external_revenue, false);
  assert.equal(r.live_provider_call, false);
});

test('evaluateSettlementWithStripeFetch uses adapter then join', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'pi_fixture123',
      livemode: true,
      status: 'succeeded',
      latest_charge: {
        id: 'ch_1',
        amount_captured: 1500,
        currency: 'nzd',
        balance_transaction: {
          id: 'txn_1',
          type: 'charge',
          amount: 1500,
          fee: 45,
          net: 1455,
          currency: 'nzd',
          fee_details: [{ type: 'stripe_fee', description: 'processing', amount: 45, currency: 'nzd' }],
        },
      },
    }),
  });
  const r = await evaluateSettlementWithStripeFetch(base, {
    secretKey: 'sk_test_fixture',
    fetchImpl,
  });
  assert.equal(r.fee_evidence_state, 'SETTLED_AND_DETAILED');
  assert.equal(r.evaluation.verdict, 'PASS');
  assert.equal(r.counts_as_verified_external_revenue, true);
});
