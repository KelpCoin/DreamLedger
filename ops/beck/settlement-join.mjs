#!/usr/bin/env node
/**
 * Join provider fee evidence into a settlement record, then evaluate.
 * The adapter is read-only. This module never writes to Stripe.
 * fee_detail_status=reconciled is only set from SETTLED_AND_DETAILED adapter output.
 */
import { evaluateSettlement } from './settlement-truth.mjs';
import { fetchStripeFeeEvidence } from './stripe-fee-reconcile.mjs';

/**
 * @param {object} baseRecord commercial/settlement fields (offer, buyer, fulfil, etc.)
 * @param {object} feeEvidence return value of fetchStripeFeeEvidence
 */
export function joinSettlementWithProviderFee(baseRecord, feeEvidence) {
  if (!baseRecord || typeof baseRecord !== 'object') {
    return evaluateSettlement(null);
  }
  if (!feeEvidence || typeof feeEvidence !== 'object') {
    return evaluateSettlement({
      ...baseRecord,
      fee_detail_status: 'pending',
    });
  }

  if (feeEvidence.state === 'SETTLED_PENDING_DETAIL') {
    return evaluateSettlement({
      ...baseRecord,
      payment_intent_id: baseRecord.payment_intent_id || feeEvidence.payment_intent_id,
      fee_detail_status: 'pending',
      balance_transaction_id: null,
      fee_minor: null,
    });
  }

  if (feeEvidence.state !== 'SETTLED_AND_DETAILED') {
    return evaluateSettlement({
      ...baseRecord,
      fee_detail_status: baseRecord.fee_detail_status === 'reconciled' ? 'pending' : (baseRecord.fee_detail_status || 'pending'),
    });
  }

  if (
    baseRecord.payment_intent_id &&
    feeEvidence.payment_intent_id &&
    baseRecord.payment_intent_id !== feeEvidence.payment_intent_id
  ) {
    return {
      verdict: 'BLOCKED',
      reason: 'PAYMENT_INTENT_MISMATCH',
      missing: ['payment_intent_id_match'],
      counts_as_verified_external_revenue: false,
    };
  }

  const joined = {
    ...baseRecord,
    payment_intent_id: baseRecord.payment_intent_id || feeEvidence.payment_intent_id,
    status: baseRecord.status || (feeEvidence.livemode ? 'succeeded' : baseRecord.status),
    livemode: baseRecord.livemode === true ? true : feeEvidence.livemode === true,
    fee_detail_status: 'reconciled',
    balance_transaction_id: feeEvidence.balance_transaction_id,
    fee_minor: feeEvidence.fee_minor,
    currency: feeEvidence.currency,
    amount_minor: feeEvidence.amount_minor,
    provider_fee_evidence: {
      source: 'stripe_balance_transaction',
      state: feeEvidence.state,
      charge_id: feeEvidence.charge_id,
      net_minor: feeEvidence.net_minor,
      amount_minor: feeEvidence.amount_minor,
      fee_minor: feeEvidence.fee_minor,
      fee_details: feeEvidence.fee_details,
      currency: feeEvidence.currency,
      provider: feeEvidence.provider || 'stripe',
    },
  };

  return evaluateSettlement(joined);
}

/**
 * Optional live path: fetch fee evidence then join.
 * Without STRIPE_SECRET_KEY returns NOT_RUN-style BLOCKED, not PASS.
 */
export async function evaluateSettlementWithStripeFetch(baseRecord, opts = {}) {
  const pi = baseRecord?.payment_intent_id;
  const feeEvidence = await fetchStripeFeeEvidence({
    paymentIntentId: pi,
    secretKey: opts.secretKey ?? process.env.STRIPE_SECRET_KEY,
    fetchImpl: opts.fetchImpl,
  });
  const evaluation = joinSettlementWithProviderFee(baseRecord, feeEvidence);
  return {
    fee_evidence_state: feeEvidence.state,
    fee_evidence_reason: feeEvidence.reason || null,
    evaluation,
    counts_as_verified_external_revenue: evaluation.counts_as_verified_external_revenue === true,
    live_provider_call: Boolean(opts.secretKey || process.env.STRIPE_SECRET_KEY),
  };
}
