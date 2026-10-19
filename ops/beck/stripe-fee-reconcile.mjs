#!/usr/bin/env node
/**
 * Read-only Stripe fee reconciliation.
 * Fetches a PaymentIntent with latest_charge.balance_transaction expanded.
 * Never writes to Stripe, emits the API key, or treats missing fee detail as settled.
 */
export async function fetchStripeFeeEvidence({
  paymentIntentId,
  secretKey = process.env.STRIPE_SECRET_KEY,
  fetchImpl = globalThis.fetch,
}) {
  if (!paymentIntentId || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
    return { state: 'BLOCKED', reason: 'INVALID_PAYMENT_INTENT_ID' };
  }
  if (!secretKey || !/^sk_(live|test)_/.test(secretKey)) {
    return { state: 'BLOCKED', reason: 'STRIPE_SECRET_KEY_MISSING_OR_INVALID' };
  }
  const url = new URL('https://api.stripe.com/v1/payment_intents/' + encodeURIComponent(paymentIntentId));
  url.searchParams.append('expand[]', 'latest_charge.balance_transaction');

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64') },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { state: 'BLOCKED', reason: 'STRIPE_PROVIDER_UNAVAILABLE', retryable: true };
  }
  if (!response.ok) {
    return {
      state: 'BLOCKED',
      reason: response.status === 404 ? 'PAYMENT_INTENT_NOT_FOUND' : 'STRIPE_READ_FAILED',
      http_status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    };
  }

  let pi;
  try { pi = await response.json(); } catch {
    return { state: 'BLOCKED', reason: 'STRIPE_RESPONSE_INVALID' };
  }
  if (pi.id !== paymentIntentId) return { state: 'BLOCKED', reason: 'PAYMENT_INTENT_ID_MISMATCH' };
  const keyIsLive = secretKey.startsWith('sk_live_');
  if (pi.livemode !== keyIsLive) return { state: 'BLOCKED', reason: 'STRIPE_MODE_MISMATCH' };
  if (pi.livemode !== true) return { state: 'BLOCKED', reason: 'NOT_LIVE_MODE' };
  if (pi.status !== 'succeeded') return { state: 'BLOCKED', reason: 'PAYMENT_NOT_SUCCEEDED', provider_status: pi.status || 'unknown' };

  const charge = pi.latest_charge;
  if (!charge || typeof charge !== 'object' || !charge.id) {
    return { state: 'SETTLED_PENDING_DETAIL', reason: 'LATEST_CHARGE_NOT_EXPANDED', payment_intent_id: pi.id, retryable: true };
  }
  const bt = charge.balance_transaction;
  if (!bt || typeof bt !== 'object' || !bt.id) {
    return {
      state: 'SETTLED_PENDING_DETAIL',
      reason: 'BALANCE_TRANSACTION_PENDING',
      payment_intent_id: pi.id,
      charge_id: charge.id,
      amount_minor: Number.isSafeInteger(charge.amount_captured) ? charge.amount_captured : null,
      currency: typeof charge.currency === 'string' ? charge.currency.toLowerCase() : null,
      retryable: true,
    };
  }
  if (!Number.isSafeInteger(bt.fee) || bt.fee < 0 || typeof bt.currency !== 'string' || !/^[a-z]{3}$/.test(bt.currency)) {
    return { state: 'BLOCKED', reason: 'BALANCE_TRANSACTION_FIELDS_INVALID', payment_intent_id: pi.id, charge_id: charge.id };
  }
  if (!Array.isArray(bt.fee_details) || bt.fee_details.length === 0) {
    return { state: 'BLOCKED', reason: 'BALANCE_TRANSACTION_FEE_DETAILS_MISSING', payment_intent_id: pi.id, balance_transaction_id: bt.id };
  }
  const feeDetails = bt.fee_details.map((detail) => ({
    type: typeof detail?.type === 'string' ? detail.type : null,
    description: typeof detail?.description === 'string' ? detail.description : null,
    amount_minor: detail?.amount,
    currency: typeof detail?.currency === 'string' ? detail.currency.toLowerCase() : null,
  }));
  if (feeDetails.some((detail) => !Number.isSafeInteger(detail.amount_minor) || detail.amount_minor < 0 || !detail.currency || !/^[a-z]{3}$/.test(detail.currency))) {
    return { state: 'BLOCKED', reason: 'BALANCE_TRANSACTION_FEE_DETAILS_INVALID', payment_intent_id: pi.id, balance_transaction_id: bt.id };
  }
  if (feeDetails.reduce((sum, detail) => sum + detail.amount_minor, 0) !== bt.fee) {
    return { state: 'BLOCKED', reason: 'BALANCE_TRANSACTION_FEE_DETAILS_MISMATCH', payment_intent_id: pi.id, balance_transaction_id: bt.id };
  }
  if (feeDetails.some((detail) => detail.currency !== bt.currency.toLowerCase())) {
    return { state: 'BLOCKED', reason: 'BALANCE_TRANSACTION_FEE_CURRENCY_MISMATCH', payment_intent_id: pi.id, balance_transaction_id: bt.id };
  }
  if (bt.type && !String(bt.type).includes('charge')) {
    return { state: 'BLOCKED', reason: 'BALANCE_TRANSACTION_TYPE_UNEXPECTED', payment_intent_id: pi.id, balance_transaction_id: bt.id };
  }
  return {
    state: 'SETTLED_AND_DETAILED',
    payment_intent_id: pi.id,
    charge_id: charge.id,
    balance_transaction_id: bt.id,
    amount_minor: Number.isSafeInteger(bt.amount) ? bt.amount : null,
    fee_minor: bt.fee,
    fee_details: feeDetails,
    net_minor: Number.isSafeInteger(bt.net) ? bt.net : null,
    currency: bt.currency.toLowerCase(),
    livemode: true,
    provider: 'stripe',
  };
}
