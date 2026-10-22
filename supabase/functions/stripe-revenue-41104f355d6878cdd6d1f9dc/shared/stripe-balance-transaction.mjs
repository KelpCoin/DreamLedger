/**
 * Provider evidence guard for paid Stripe Checkout sessions.
 * Pure validation only: no network calls, database writes, or revenue claim.
 */
const blocked = (reason) => ({ state: 'BLOCKED', reason, retryable: false });
const pending = (reason) => ({ state: 'SETTLED_PENDING_DETAIL', reason, retryable: true });
const isMinor = (value) => Number.isSafeInteger(value) && value >= 0;
const isCurrency = (value) => typeof value === 'string' && /^[a-z]{3}$/i.test(value);

export function validateStripeBalanceTransaction({ session, paymentIntent }) {
  if (!session || typeof session !== 'object') return blocked('CHECKOUT_SESSION_MISSING');
  if (!paymentIntent || typeof paymentIntent !== 'object') return blocked('PAYMENT_INTENT_MISSING');

  if (session.livemode !== true || paymentIntent.livemode !== true) return blocked('NOT_LIVE_MODE');
  if (session.status !== 'complete' || session.payment_status !== 'paid') return blocked('CHECKOUT_SESSION_NOT_PAID');
  if (paymentIntent.status !== 'succeeded') return blocked('PAYMENT_INTENT_NOT_SUCCEEDED');

  const sessionIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent && typeof session.payment_intent.id === 'string'
      ? session.payment_intent.id
      : null;
  if (!sessionIntentId || sessionIntentId !== paymentIntent.id) return blocked('PAYMENT_INTENT_ID_MISMATCH');

  const gross = session.amount_total;
  const currency = String(session.currency || '').toLowerCase();
  if (!Number.isSafeInteger(gross) || gross <= 0 || !isCurrency(currency)) return blocked('CHECKOUT_AMOUNT_OR_CURRENCY_INVALID');
  if (!isMinor(paymentIntent.amount_received) || paymentIntent.amount_received !== gross) return blocked('PAYMENT_INTENT_AMOUNT_MISMATCH');
  if (String(paymentIntent.currency || '').toLowerCase() !== currency) return blocked('PAYMENT_INTENT_CURRENCY_MISMATCH');

  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge !== 'object' || !charge.id) return pending('LATEST_CHARGE_NOT_EXPANDED');
  if (charge.livemode !== true) return blocked('CHARGE_NOT_LIVE_MODE');
  if (!isMinor(charge.amount_captured) || charge.amount_captured !== gross) return blocked('CHARGE_AMOUNT_MISMATCH');
  if (String(charge.currency || '').toLowerCase() !== currency) return blocked('CHARGE_CURRENCY_MISMATCH');

  const balance = charge.balance_transaction;
  if (!balance || typeof balance !== 'object' || !balance.id) return pending('BALANCE_TRANSACTION_PENDING');
  if (!isMinor(balance.amount) || !isMinor(balance.fee) || !isMinor(balance.net)) return blocked('BALANCE_TRANSACTION_FIELDS_INVALID');
  const balanceCurrency = String(balance.currency || '').toLowerCase();
  if (!isCurrency(balanceCurrency) || balanceCurrency !== currency) return blocked('BALANCE_TRANSACTION_CURRENCY_MISMATCH');
  if (balance.amount !== gross) return blocked('BALANCE_TRANSACTION_AMOUNT_MISMATCH');
  if (balance.fee > balance.amount || balance.amount - balance.fee !== balance.net) return blocked('BALANCE_TRANSACTION_NET_MISMATCH');
  if (!Array.isArray(balance.fee_details) || balance.fee_details.length === 0) return blocked('BALANCE_TRANSACTION_FEE_DETAILS_MISSING');

  const feeDetails = balance.fee_details.map((row) => ({
    type: typeof row?.type === 'string' ? row.type : null,
    description: typeof row?.description === 'string' ? row.description : null,
    amount_minor: row?.amount,
    currency: typeof row?.currency === 'string' ? row.currency.toLowerCase() : null,
  }));
  if (feeDetails.some((row) => !isMinor(row.amount_minor) || !isCurrency(row.currency))) {
    return blocked('BALANCE_TRANSACTION_FEE_DETAILS_INVALID');
  }
  if (feeDetails.some((row) => row.currency !== balanceCurrency)) return blocked('BALANCE_TRANSACTION_FEE_CURRENCY_MISMATCH');
  if (feeDetails.reduce((sum, row) => sum + row.amount_minor, 0) !== balance.fee) {
    return blocked('BALANCE_TRANSACTION_FEE_DETAILS_MISMATCH');
  }

  return {
    state: 'SETTLED_AND_DETAILED',
    retryable: false,
    source: 'stripe_balance_transaction',
    payment_intent_id: paymentIntent.id,
    charge_id: charge.id,
    balance_transaction_id: balance.id,
    amount_minor: balance.amount,
    fee_minor: balance.fee,
    net_minor: balance.net,
    currency: balanceCurrency,
    fee_details: feeDetails,
    livemode: true,
  };
}
