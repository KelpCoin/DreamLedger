#!/usr/bin/env node
/**
 * Settlement truth evaluator.
 * status=succeeded + livemode=true alone is insufficient.
 * Pending fee details remain pending; they do not grant revenue PASS.
 */

export function evaluateSettlement(record) {
  const missing = [];
  if (!record) return { verdict: 'BLOCKED', reason: 'NO_RECORD', missing: ['record'] };

  if (record.status !== 'succeeded') missing.push('status_succeeded');
  if (record.livemode !== true) missing.push('livemode_true');
  if (!record.offer_id && !record.price_id && !record.payment_link_id) missing.push('matched_offer');
  if (!record.independent_buyer) missing.push('independent_buyer');
  if (!record.fulfillment_status || !['completed', 'claimable', 'delivered'].includes(record.fulfillment_status)) {
    missing.push('fulfillment');
  }
  if (!record.delivery_proof_ref) missing.push('delivery_proof');

  if (record.fee_detail_status === 'pending') {
    return {
      verdict: 'BLOCKED',
      reason: 'FEE_DETAIL_PENDING',
      missing,
      note: 'Pending fee detail must not shortcut the full revenue gate.',
      counts_as_verified_external_revenue: false,
    };
  }

  if (missing.length) {
    return {
      verdict: 'BLOCKED',
      reason: 'INCOMPLETE_SETTLEMENT_TRUTH',
      missing,
      counts_as_verified_external_revenue: false,
    };
  }

  return {
    verdict: 'PASS',
    reason: 'FULL_CHAIN',
    missing: [],
    counts_as_verified_external_revenue: true,
  };
}

export function separateKillCriteria({ verifiedSales = [], qualityRows = [] }) {
  const verified = verifiedSales.filter((s) => s.counts_as_verified_external_revenue === true);
  const warnings = qualityRows.filter((r) => r.status === 'unverified' || r.status === 'rejected');
  return {
    verified_revenue_decision: verified.length > 0 ? 'HAS_VERIFIED_SALE' : 'NO_VERIFIED_SALE',
    verified_count: verified.length,
    data_quality_warning_count: warnings.length,
    note: 'Unverified/rejected rows do not erase a legitimate verified sale.',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = evaluateSettlement({
    status: 'succeeded',
    livemode: true,
  });
  console.log(JSON.stringify({ demo_insufficient: demo }, null, 2));
  process.exit(demo.verdict === 'PASS' ? 0 : 1);
}
