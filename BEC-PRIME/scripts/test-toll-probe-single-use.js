'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DREAMLEDGER_TOLL_KEY_SECRET = 'unit-test-toll-secret';
process.env.STRIPE_SECRET_KEY = 'mocked_stripe_secret_for_unit_tests';
process.env.PUBLIC_BASE_URL = 'https://dreamledger.org';

let stripeSession = null;
let checkoutForm = null;
const originalFetch = global.fetch;

function response(payload, ok = true, status = 200) {
  return { ok, status, text: async () => JSON.stringify(payload) };
}

global.fetch = async (url, options = {}) => {
  const target = String(url);
  const method = String(options.method || 'GET').toUpperCase();

  if (target === 'https://api.stripe.com/v1/checkout/sessions' && method === 'POST') {
    checkoutForm = new URLSearchParams(options.body);
    stripeSession = {
      id: 'cs_live_test_probe',
      url: 'https://checkout.stripe.com/c/pay/cs_live_test_probe',
      livemode: true,
      payment_status: 'unpaid',
      amount_total: Number(checkoutForm.get('line_items[0][price_data][unit_amount]')),
      currency: checkoutForm.get('line_items[0][price_data][currency]'),
      created: Math.floor(Date.now() / 1000),
      metadata: {}
    };
    for (const [key, value] of checkoutForm.entries()) {
      const match = key.match(/^metadata\[([^\]]+)\]$/);
      if (match) stripeSession.metadata[match[1]] = value;
    }
    return response(stripeSession);
  }

  if (target.endsWith('/checkout/sessions/cs_live_test_probe') && method === 'GET') {
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
  const Toll = require('../runtime/TollRoad');
  const key = Toll.issueKey({
    keyId: 'TOLL_test_probe',
    tier: 'toll-probe',
    callsRemaining: 1,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    reference: stripeSession.id
  });

  const first = await invoke(routes.handle, fakeRequest('POST', '/api/toll/v1/probe', key), '/api/toll/v1/probe');
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.receipt_id, 'PROBE-' + require('crypto').createHash('sha256').update(stripeSession.id).digest('hex').slice(0, 24));
  assert.equal(first.body.attribution.referrer_id, 'qr');
  assert.equal(first.body.attribution.campaign_id, 'universal-20261011');
  assert.equal(first.body.replayed, false);
  assert.equal(stripeSession.metadata.probe_consumed, 'true');

  const retry = await invoke(routes.handle, fakeRequest('POST', '/api/toll/v1/probe', key), '/api/toll/v1/probe');
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.receipt_id, first.body.receipt_id);
  assert.equal(retry.body.replayed, true);

  delete require.cache[routePath];
  routes = require('../routes/tollRoad');
  const afterRestart = await invoke(routes.handle, fakeRequest('POST', '/api/toll/v1/probe', key), '/api/toll/v1/probe');
  assert.equal(afterRestart.statusCode, 200);
  assert.equal(afterRestart.body.receipt_id, first.body.receipt_id);
  assert.equal(afterRestart.body.replayed, true);
});

