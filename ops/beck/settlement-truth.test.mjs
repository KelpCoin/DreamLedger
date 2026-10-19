import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSettlement, separateKillCriteria } from './settlement-truth.mjs';

const full = {
  status: 'succeeded', livemode: true, payment_intent_id: 'pi_fixture',
  offer_id: 'offer_fixture', independent_buyer: true,
  buyer_evidence_ref: 'evidence/buyer.json', fulfillment_status: 'delivered',
  delivery_proof_ref: 'evidence/delivery.json', fee_detail_status: 'reconciled',
  balance_transaction_id: 'txn_fixture', fee_minor: 12, currency: 'nzd',
  provider_fee_evidence: {
    source: 'stripe_balance_transaction', fee_minor: 12, currency: 'nzd',
    fee_details: [{ amount_minor: 12, currency: 'nzd', type: 'stripe_fee' }],
    amount_minor: 1200,
  }, amount_minor: 1200,
};

test('succeeded and live mode alone is blocked', () => {
  const r = evaluateSettlement({ status: 'succeeded', livemode: true });
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.counts_as_verified_external_revenue, false);
  assert.ok(r.missing.includes('matched_offer'));
  assert.ok(r.missing.includes('independent_buyer'));
  assert.ok(r.missing.includes('fee_detail_reconciled'));
});

test('pending fee detail blocks revenue', () => {
  const r = evaluateSettlement({ ...full, fee_detail_status: 'pending', balance_transaction_id: null, fee_minor: null });
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.reason, 'FEE_DETAIL_PENDING');
  assert.equal(r.counts_as_verified_external_revenue, false);
});

test('missing or unknown fee state cannot pass', () => {
  for (const fee_detail_status of [undefined, 'unknown']) {
    const r = evaluateSettlement({ ...full, fee_detail_status });
    assert.equal(r.verdict, 'BLOCKED');
    assert.equal(r.counts_as_verified_external_revenue, false);
  }
});

test('complete provider, buyer, fulfillment and delivery evidence passes', () => {
  const r = evaluateSettlement(full);
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.counts_as_verified_external_revenue, true);
});

test('fee breakdown missing or inconsistent blocks revenue', () => {
  const noBreakdown = evaluateSettlement({ ...full, provider_fee_evidence: { source: 'stripe_balance_transaction', fee_minor: 12, currency: 'nzd', fee_details: [] } });
  assert.equal(noBreakdown.verdict, 'BLOCKED');
  const mismatch = evaluateSettlement({ ...full, provider_fee_evidence: { ...full.provider_fee_evidence, fee_details: [{ amount_minor: 11, currency: 'nzd' }] } });
  assert.equal(mismatch.verdict, 'BLOCKED');
});

test('malformed fee details block revenue', () => {
  for (const change of [{ balance_transaction_id: null }, { fee_minor: -1 }, { fee_minor: 1.5 }, { currency: 'NZD' }]) {
    const r = evaluateSettlement({ ...full, ...change });
    assert.equal(r.verdict, 'BLOCKED');
    assert.equal(r.counts_as_verified_external_revenue, false);
  }
});

test('kill criteria separate verified revenue from data quality warnings', () => {
  const k = separateKillCriteria({
    verifiedSales: [{ counts_as_verified_external_revenue: true }],
    qualityRows: [{ status: 'unverified' }, { status: 'rejected' }],
  });
  assert.equal(k.verified_revenue_decision, 'HAS_VERIFIED_SALE');
  assert.equal(k.verified_count, 1);
  assert.equal(k.data_quality_warning_count, 2);
});
