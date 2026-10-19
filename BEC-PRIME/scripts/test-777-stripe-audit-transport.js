'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { stripeGet } = require('./audit-777-stripe-offer-parity');

function response(status, body, override = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
    ...override
  };
}

test('every non-2xx provider response fails closed instead of yielding a success-shaped payload', async () => {
  const originalFetch = global.fetch;
  try {
    for (const status of [400, 401, 403, 404, 409, 429, 500, 502, 503]) {
      global.fetch = async () => response(status, { error: { code: 'TEST_' + status } });
      await assert.rejects(
        stripeGet('sk_live_test_only', 'payment_links'),
        new RegExp('Stripe GET failed \\(' + status)
      );
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test('HTTP success with non-JSON body is still a provider failure', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => response(200, 'not-json');
    await assert.rejects(stripeGet('sk_live_test_only', 'payment_links'), /invalid JSON/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('HTTP success returns the provider object without rewriting its fields', async () => {
  const originalFetch = global.fetch;
  const payload = { data: [{ id: 'plink_123', active: false, livemode: true }], has_more: false };
  try {
    global.fetch = async (_url, init) => {
      assert.equal(init.method, 'GET');
      assert.match(init.headers.Authorization, /^Bearer sk_live_test_only$/);
      return response(200, payload);
    };
    assert.deepEqual(await stripeGet('sk_live_test_only', 'payment_links'), payload);
  } finally {
    global.fetch = originalFetch;
  }
});

console.log('777_STRIPE_API_ERROR_PROPAGATION=PASS');
