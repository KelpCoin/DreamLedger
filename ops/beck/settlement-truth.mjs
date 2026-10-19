#!/usr/bin/env node
/**
 * Settlement truth evaluator.
 * This is a fail-closed evidence join, not a Stripe API client.
 * The caller must fetch and persist the provider's balance transaction before
 * setting fee_detail_status=reconciled. Never infer fees from webhook payloads.
 */
export function evaluateSettlement(record) {
  const missing = [];
  if (!record) return { verdict: 'BLOCKED', reason: 'NO_RECORD', missing: ['record'], counts_as_verified_external_revenue: false };

  if (record.status !== 'succeeded') missing.push('status_succeeded');
  if (record.livemode !== true) missing.push('livemode_true');
  if (!record.payment_intent_id) missing.push('payment_intent_id');
  if (!record.offer_id && !record.price_id && !record.payment_link_id) missing.push('matched_offer');
  if (record.independent_buyer !== true) missing.push('independent_buyer');
  if (!record.buyer_evidence_ref) missing.push('buyer_evidence_ref');
  if (!record.fulfillment_status || !['completed', 'claimable', 'delivered'].includes(record.fulfillment_status)) missing.push('fulfillment');
  if (!record.delivery_proof_ref) missing.push('delivery_proof');

  const feeMissing = [];
  if (record.fee_detail_status !== 'reconciled') feeMissing.push('fee_detail_reconciled');
  const providerFee = record.provider_fee_evidence;
  if (!providerFee || providerFee.source !== 'stripe_balance_transaction' || !Array.isArray(providerFee.fee_details) || providerFee.fee_details.length === 0) {
    feeMissing.push('provider_fee_details_evidence');
  } else {
    const detailAmounts = providerFee.fee_details.map((detail) => detail?.amount_minor);
    if (detailAmounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)
      || detailAmounts.reduce((sum, amount) => sum + amount, 0) !== record.fee_minor
      || providerFee.fee_details.some((detail) => String(detail?.currency || '').toLowerCase() !== record.currency)) {
      feeMissing.push('provider_fee_details_reconcile');
    }
    if (providerFee.fee_minor !== record.fee_minor || providerFee.currency !== record.currency) {
      feeMissing.push('provider_fee_evidence_matches_record');
    }
    if (!Number.isSafeInteger(providerFee.amount_minor) || !Number.isSafeInteger(record.amount_minor)
      || providerFee.amount_minor !== record.amount_minor) {
      feeMissing.push('provider_amount_matches_record');
    }
    if (!Number.isSafeInteger(providerFee.net_minor)
      || !Number.isSafeInteger(providerFee.amount_minor)
      || providerFee.amount_minor - record.fee_minor !== providerFee.net_minor) {
      feeMissing.push('provider_net_reconciles_gross_less_fee');
    }
  }
  if (!record.balance_transaction_id) feeMissing.push('balance_transaction_id');
  if (!Number.isSafeInteger(record.fee_minor) || record.fee_minor < 0) feeMissing.push('fee_minor');
  if (typeof record.currency !== 'string' || !/^[a-z]{3}$/.test(record.currency)) feeMissing.push('currency');

  if (record.fee_detail_status === 'pending') {
    return {
      verdict: 'BLOCKED',
      reason: 'FEE_DETAIL_PENDING',
      missing: [...missing, ...feeMissing],
      counts_as_verified_external_revenue: false,
      note: 'Provider fee detail remains pending; this is not revenue PASS.',
    };
  }
  if (feeMissing.length) missing.push(...feeMissing);

  if (missing.length) {
    return {
      verdict: 'BLOCKED',
      reason: 'INCOMPLETE_SETTLEMENT_TRUTH',
      missing: [...new Set(missing)],
      counts_as_verified_external_revenue: false,
    };
  }

  return {
    verdict: 'PASS',
    reason: 'FULL_CHAIN_AND_PROVIDER_FEE_RECONCILED',
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
  const demo = evaluateSettlement({ status: 'succeeded', livemode: true });
  console.log(JSON.stringify({ demo_insufficient: demo }, null, 2));
  process.exit(demo.verdict === 'PASS' ? 1 : 0);
}
