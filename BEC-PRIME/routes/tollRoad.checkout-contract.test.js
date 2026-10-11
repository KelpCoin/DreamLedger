'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  };
}

function fakeResponse() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(body = '') {
      this.body = String(body);
      this.writableEnded = true;
    }
  };
}

test('TOLL-PROBE checkout pins the existing Price ID and attributes both Stripe objects; redemption fails closed', async () => {
  const oldKey = process.env.STRIPE_SECRET_KEY;
  const oldTollSecret = process.env.DREAMLEDGER_TOLL_KEY_SECRET;
  const oldFetch = global.fetch;
  const priceId = 'price_1UNpvxEGgEAnUFF9OLa7dXKM';
  let checkoutForm = null;
  let stripeSession = null;

  process.env.STRIPE_SECRET_KEY = 'sk_test_contract_test_key_not_real';
  process.env.DREAMLEDGER_TOLL_KEY_SECRET = 'test-only-toll-key-secret';

  try {
    const TollRoad = require('./tollRoad');

    global.fetch = async (url, init = {}) => {
      const u = String(url);
      if (u === 'https://api.stripe.com/v1/checkout/sessions' && init.method === 'POST') {
        checkoutForm = new URLSearchParams(init.body);
        return response(200, { id: 'cs_test_toll_contract', url: 'https://checkout.stripe.com/c/pay/cs_test_toll_contract' });
      }
      if (u.includes('/v1/checkout/sessions/')) {
        return response(200, stripeSession);
      }
      throw new Error('Unexpected Stripe request in isolated test: ' + u);
    };

    const checkoutRes = fakeResponse();
    await TollRoad.handle(
      { method: 'GET', url: '/api/toll/v1/checkout/toll-probe', headers: {} },
      checkoutRes,
      '/api/toll/v1/checkout/toll-probe'
    );

    assert.equal(checkoutRes.statusCode, 303);
    assert.equal(checkoutForm.get('line_items[0][price]'), priceId);
    assert.equal(checkoutForm.has('line_items[0][price_data][unit_amount]'), false);
    for (const key of [
      'metadata[dreamledger_sku]',
      'metadata[product_sku]',
      'payment_intent_data[metadata][dreamledger_sku]',
      'payment_intent_data[metadata][product_sku]'
    ]) {
      assert.equal(checkoutForm.get(key), 'TOLL-PROBE-50C', 'wrong or missing ' + key);
    }
    assert.equal(checkoutForm.get('metadata[toll_scope]'), 'toll-probe');
    assert.equal(checkoutForm.get('payment_intent_data[metadata][toll_scope]'), 'toll-probe');
    assert.equal(checkoutForm.get('payment_intent_data[metadata][source]'), 'api_toll_checkout');

    const goodSession = {
      id: 'cs_live_toll_contract',
      livemode: true,
      payment_status: 'paid',
      currency: 'nzd',
      amount_total: 50,
      created: Math.floor(Date.now() / 1000),
      metadata: { toll_scope: 'toll-probe', dreamledger_sku: 'TOLL-PROBE-50C' },
      line_items: { data: [{ amount_total: 50, price: { id: priceId, unit_amount: 50 } }] }
    };

    stripeSession = { ...goodSession };
    const validRes = fakeResponse();
    await TollRoad.handle(
      { method: 'POST', url: '/api/toll/v1/redeem/toll-probe?session_id=cs_live_toll_contract', headers: {} },
      validRes,
      '/api/toll/v1/redeem/toll-probe'
    );
    assert.equal(validRes.statusCode, 200);

    stripeSession = {
      ...goodSession,
      id: 'cs_live_wrong_sku',
      metadata: { toll_scope: 'toll-probe', dreamledger_sku: 'WRONG-SKU' }
    };
    const skuRes = fakeResponse();
    await TollRoad.handle(
      { method: 'POST', url: '/api/toll/v1/redeem/toll-probe?session_id=cs_live_wrong_sku', headers: {} },
      skuRes,
      '/api/toll/v1/redeem/toll-probe'
    );
    assert.equal(skuRes.statusCode, 409);
    assert.match(skuRes.body, /SKU attribution mismatch/);

    stripeSession = {
      ...goodSession,
      id: 'cs_live_wrong_price',
      line_items: { data: [{ amount_total: 50, price: { id: 'price_wrong', unit_amount: 50 } }] }
    };
    const priceRes = fakeResponse();
    await TollRoad.handle(
      { method: 'POST', url: '/api/toll/v1/redeem/toll-probe?session_id=cs_live_wrong_price', headers: {} },
      priceRes,
      '/api/toll/v1/redeem/toll-probe'
    );
    assert.equal(priceRes.statusCode, 409);
    assert.match(priceRes.body, /Stripe Price ID mismatch/);

    stripeSession = {
      ...goodSession,
      id: 'cs_unpaid',
      payment_status: 'unpaid'
    };
    const unpaidRes = fakeResponse();
    await TollRoad.handle(
      { method: 'POST', url: '/api/toll/v1/redeem/toll-probe?session_id=cs_unpaid', headers: {} },
      unpaidRes,
      '/api/toll/v1/redeem/toll-probe'
    );
    assert.equal(unpaidRes.statusCode, 402);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = oldKey;
    if (oldTollSecret === undefined) delete process.env.DREAMLEDGER_TOLL_KEY_SECRET;
    else process.env.DREAMLEDGER_TOLL_KEY_SECRET = oldTollSecret;
  }
});
