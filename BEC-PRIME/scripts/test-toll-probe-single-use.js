'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DREAMLEDGER_TOLL_KEY_SECRET = 'unit-test-toll-secret';
process.env.STRIPE_SECRET_KEY = 'mocked_stripe_secret_for_unit_tests';
process.env.PUBLIC_BASE_URL = 'https://dreamledger.org';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_for_unit_tests';
process.env.TOLL_CHECKOUT_ENABLED = 'true';

let stripeSession = null;
let checkoutForm = null;
const entitlements = new Map();
const usageEvents = new Map();
const originalFetch = global.fetch;

function response(payload, ok = true, status = 200) {
  return { ok, status, text: async () => JSON.stringify(payload) };
}

global.fetch = async (url, options = {}) => {
  const target = String(url);
  const method = String(options.method || 'GET').toUpperCase();

  if (target === 'https://mock.supabase.co/rest/v1/rpc/register_toll_probe_entitlement' && method === 'POST') {
    const args = JSON.parse(options.body);
    const existing = entitlements.get(args.p_checkout_session_id);
    if (existing && existing.key_id !== args.p_key_id) return response({ error: 'session already bound' }, false, 409);
    const row = existing || {
      key_id: args.p_key_id,
      checkout_session_id: args.p_checkout_session_id,
      scope: args.p_scope,
      calls_granted: args.p_calls_granted,
      calls_remaining: args.p_calls_granted,
      expires_at: args.p_expires_at,
      status: 'active',
      livemode: args.p_livemode,
      amount_minor: args.p_amount_minor,
      currency: args.p_currency
    };
    entitlements.set(args.p_checkout_session_id, row);
    return response({ ok: true, key_id: row.key_id, calls_remaining: row.calls_remaining, status: row.status });
  }

  if (target === 'https://mock.supabase.co/rest/v1/rpc/consume_toll_probe_quota' && method === 'POST') {
    const args = JSON.parse(options.body);
    const prior = usageEvents.get(args.p_idempotency_key);
    if (prior) {
      if (prior.key_id !== args.p_key_id) return response({ error: 'idempotency collision' }, false, 409);
      return response({ ok: true, replayed: true, key_id: prior.key_id, calls_remaining: prior.calls_remaining, consumed_at: prior.consumed_at });
    }
    const row = [...entitlements.values()].find(item => item.key_id === args.p_key_id);
    if (!row) return response({ error: 'entitlement not found' }, false, 404);
    if (row.status !== 'active' || row.calls_remaining < 1) return response({ error: 'quota exhausted' }, false, 409);
    row.calls_remaining -= 1;
    if (row.calls_remaining === 0) row.status = 'exhausted';
    const event = { key_id: row.key_id, calls_remaining: row.calls_remaining, consumed_at: new Date().toISOString() };
    usageEvents.set(args.p_idempotency_key, event);
    return response({ ok: true, replayed: false, key_id: row.key_id, calls_remaining: row.calls_remaining, consumed_at: event.consumed_at });
  }

  if (target === 'https://api.stripe.com/v1/checkout/sessions' && method === 'POST') {
    checkoutForm = new URLSearchParams(options.body);
    stripeSession = {
      id: 'cs_live_test_probe',
      url: 'https://checkout.stripe.com/c/pay/cs_live_test_probe',
      livemode: true,
      payment_status: 'unpaid',
      amount_total: Number(checkoutForm.get('line_items[0][price_data][unit_amount]')),
      currency: checkoutForm.get('line_items[0][price_data][currency]'),
      line_items: { data: [{ amount_total: Number(checkoutForm.get('line_items[0][price_data][unit_amount]')) }] },
      payment_intent: 'pi_live_test_probe',
      created: Math.floor(Date.now() / 1000),
      metadata: {}
    };
    for (const [key, value] of checkoutForm.entries()) {
      const match = key.match(/^metadata\[([^\]]+)\]$/);
      if (match) stripeSession.metadata[match[1]] = value;
    }
    return response(stripeSession);
  }

  if (target.includes('/checkout/sessions/cs_live_test_probe') && method === 'GET') {
    return response(stripeSession || {}, Boolean(stripeSession), stripeSession ? 200 : 404);
  }

  if (target.endsWith('/checkout/sessions/cs_live_test_probe') && method === 'POST') {
    const update = new URLSearchParams(options.body);
    for (const [key, value] of update.entries()) {
      const match = key.match(/^metadata\[([^\]]+)\]$/);
      if (match) stripeSession.metadata[match[1]] = value;
    }
    return response(stripeSession);
  }

  throw new Error('Unexpected mocked Stripe request: ' + method + ' ' + target);
};

function fakeRequest(method, url, key) {
  return { method, url, headers: key ? { 'x-dreamledger-toll-key': key } : {} };
}

function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    writableEnded: false,
    writeHead(status, headers = {}) { this.statusCode = status; this.headers = headers; },
    end(body) {
      this.writableEnded = true;
      this.body = body ? JSON.parse(String(body)) : null;
    }
  };
}

async function invoke(handler, req, path) {
  const res = fakeResponse();
  await handler(req, res, path);
  return res;
}

test('toll checkout fails closed unless explicitly enabled', async (t) => {
  const originalFlag = process.env.TOLL_CHECKOUT_ENABLED;
  process.env.TOLL_CHECKOUT_ENABLED = 'false';
  checkoutForm = null;
  stripeSession = null;
  const routePath = require.resolve('../routes/tollRoad');
  delete require.cache[routePath];
  const routes = require('../routes/tollRoad');
  const response = await invoke(
    routes.handle,
    fakeRequest('GET', '/api/toll/v1/checkout/toll-probe'),
    '/api/toll/v1/checkout/toll-probe'
  );
  assert.equal(response.statusCode, 503);
  assert.match(response.body.error, /disabled until payment-to-delivery acceptance passes/);
  assert.equal(checkoutForm, null, 'must not contact Stripe while the gate is closed');
  process.env.TOLL_CHECKOUT_ENABLED = originalFlag || 'true';
  delete require.cache[routePath];
});

test('campaign attribution reaches Stripe and one paid probe returns a stable receipt', async (t) => {
  t.after(() => { global.fetch = originalFetch; });

  const routePath = require.resolve('../routes/tollRoad');
  delete require.cache[routePath];
  let routes = require('../routes/tollRoad');

  const checkout = await invoke(
    routes.handle,
    fakeRequest('GET', '/api/toll/v1/checkout/toll-probe?ref=qr&c=universal-20261011'),
    '/api/toll/v1/checkout/toll-probe'
  );
  assert.equal(checkout.statusCode, 303);
  assert.equal(checkout.headers.Location, 'https://checkout.stripe.com/c/pay/cs_live_test_probe');
  assert.equal(checkoutForm.get('metadata[referrer_id]'), 'qr');
  assert.equal(checkoutForm.get('metadata[campaign_id]'), 'universal-20261011');
  assert.equal(checkoutForm.get('payment_intent_data[metadata][referrer_id]'), 'qr');
  assert.equal(checkoutForm.get('payment_intent_data[metadata][campaign_id]'), 'universal-20261011');

  stripeSession.payment_status = 'paid';
  const redemption = await invoke(
    routes.handle,
    fakeRequest('GET', '/api/toll/v1/redeem/toll-probe?session_id=' + stripeSession.id),
    '/api/toll/v1/redeem/toll-probe'
  );
  assert.equal(redemption.statusCode, 200);
  assert.equal(redemption.body.status, 'ENTITLED');
  const key = redemption.body.key;
  assert.ok(key, 'a settled checkout must produce the scoped key only after durable entitlement registration');
  assert.equal(entitlements.get(stripeSession.id).calls_remaining, 1);

  const first = await invoke(routes.handle, fakeRequest('POST', '/api/toll/v1/probe', key), '/api/toll/v1/probe');
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.receipt_id, 'PROBE-' + require('crypto').createHash('sha256').update(stripeSession.id).digest('hex').slice(0, 24));
  assert.equal(first.body.attribution.referrer_id, 'qr');
  assert.equal(first.body.attribution.campaign_id, 'universal-20261011');
  assert.equal(first.body.replayed, false);
  assert.equal(first.body.quota_ledger, 'DURABLE');
  assert.equal(first.body.calls_remaining, 0);
  assert.equal(entitlements.get(stripeSession.id).calls_remaining, 0);
  assert.equal(usageEvents.size, 1);
  assert.equal(stripeSession.metadata.probe_consumed, 'true');

  const retry = await invoke(routes.handle, fakeRequest('POST', '/api/toll/v1/probe', key), '/api/toll/v1/probe');
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.receipt_id, first.body.receipt_id);
  assert.equal(retry.body.replayed, true);
  assert.equal(usageEvents.size, 1, 'retry must not consume quota twice');

  delete require.cache[routePath];
  routes = require('../routes/tollRoad');
  const afterRestart = await invoke(routes.handle, fakeRequest('POST', '/api/toll/v1/probe', key), '/api/toll/v1/probe');
  assert.equal(afterRestart.statusCode, 200);
  assert.equal(afterRestart.body.receipt_id, first.body.receipt_id);
  assert.equal(afterRestart.body.replayed, true);
  assert.equal(usageEvents.size, 1, 'process restart must not reset durable quota consumption');
});

