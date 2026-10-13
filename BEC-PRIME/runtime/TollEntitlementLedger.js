'use strict';

function config() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  };
}

async function rpc(name, args) {
  const { url, serviceRoleKey } = config();
  if (!url || !serviceRoleKey) {
    throw Object.assign(new Error('durable_quota_ledger_not_configured'), { statusCode: 503 });
  }
  const response = await fetch(url + '/rest/v1/rpc/' + encodeURIComponent(name), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: 'Bearer ' + serviceRoleKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(args)
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const error = Object.assign(
      new Error(response.status >= 500 ? 'durable_quota_ledger_unavailable' : 'durable_quota_request_rejected'),
      { statusCode: response.status >= 500 ? 503 : 409 }
    );
    throw error;
  }
  return Array.isArray(data) ? (data[0] || {}) : (data || {});
}

async function registerProbeEntitlement({
  keyId, checkoutSessionId, paymentIntentId, scope, callsGranted,
  expiresAt, livemode, amountMinor, currency
}) {
  return rpc('register_toll_probe_entitlement', {
    p_key_id: String(keyId),
    p_checkout_session_id: String(checkoutSessionId),
    p_payment_intent_id: paymentIntentId ? String(paymentIntentId) : '',
    p_scope: String(scope),
    p_calls_granted: Number(callsGranted),
    p_expires_at: String(expiresAt),
    p_livemode: livemode === true,
    p_amount_minor: Number(amountMinor),
    p_currency: String(currency || '').toLowerCase()
  });
}

async function consumeProbeQuota({ keyId, idempotencyKey }) {
  return rpc('consume_toll_probe_quota', {
    p_key_id: String(keyId),
    p_scope: 'toll-probe',
    p_idempotency_key: String(idempotencyKey),
    p_units: 1
  });
}

module.exports = { registerProbeEntitlement, consumeProbeQuota };
