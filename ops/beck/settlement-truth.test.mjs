import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSettlement, separateKillCriteria } from './settlement-truth.mjs';

test('succeeded+livemode alone is BLOCKED', () => {
  const r = evaluateSettlement({ status: 'succeeded', livemode: true });
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.counts_as_verified_external_revenue, false);
  assert.ok(r.missing.includes('matched_offer'));
  assert.ok(r.missing.includes('independent_buyer'));
  assert.ok(r.missing.includes('fulfillment'));
  assert.ok(r.missing.includes('delivery_proof'));
});

test('pending fee detail stays pending and blocks revenue', () => {
  const r = evaluateSettlement({
    status: 'succeeded',
    livemode: true,
    offer_id: 'off_1',
    independent_buyer: true,
    fulfillment_status: 'delivered',
    delivery_proof_ref: 'proof/x',
    fee_detail_status: 'pending',
  });
  assert.equal(r.verdict, 'BLOCKED');
  assert.equal(r.reason, 'FEE_DETAIL_PENDING');
  assert.equal(r.counts_as_verified_external_revenue, false);
});

test('full chain PASSes revenue count', () => {
  const r = evaluateSettlement({
    status: 'succeeded',
    livemode: true,
    offer_id: 'off_1',
    independent_buyer: true,
    fulfillment_status: 'delivered',
    delivery_proof_ref: 'proof/x',
    fee_detail_status: 'reconciled',
  });
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.counts_as_verified_external_revenue, true);
});

test('kill criteria separate verified revenue from quality warnings', () => {
  const k = separateKillCriteria({
    verifiedSales: [{ counts_as_verified_external_revenue: true }],
    qualityRows: [{ status: 'unverified' }, { status: 'rejected' }],
  });
  assert.equal(k.verified_revenue_decision, 'HAS_VERIFIED_SALE');
  assert.equal(k.verified_count, 1);
  assert.equal(k.data_quality_warning_count, 2);
});
