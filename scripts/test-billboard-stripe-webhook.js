#!/usr/bin/env node
/**
 * Offline Stripe webhook signature tests for Billboard cash lane.
 * No live Stripe network required. No payment claimed.
 *
 * Usage:
 *   node scripts/test-billboard-stripe-webhook.js
 */

const assert = require('assert');
const http = require('http');
const path = require('path');

const webhook = require(path.join(__dirname, '..', 'api', 'billboard-stripe-webhook.js'));
const { verifyStripeSignature, signStripePayload } = webhook;

const TEST_SECRET = 'whsec_test_dreamledger_billboard_offline_only';

function buildPaidSessionEvent() {
  return {
    id: 'evt_test_billboard_paid_001',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_billboard_001',
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 2900,
        currency: 'nzd',
        customer_details: { email: 'test@example.com' }
      }
    }
  };
}

function buildUnpaidSessionEvent() {
  const event = buildPaidSessionEvent();
  event.id = 'evt_test_billboard_unpaid_001';
  event.data.object.payment_status = 'unpaid';
  return event;
}

function invokeHandler({ method, body, signature, secret }) {
  return new Promise((resolve) => {
    const req = {
      method: method || 'POST',
      headers: {
        'stripe-signature': signature || ''
      },
      body: Buffer.from(body, 'utf8')
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      }
    };
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    Promise.resolve(webhook(req, res))
      .catch((err) => resolve({ statusCode: 500, body: { error: String(err) } }))
      .finally(() => {
        if (prev === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
        else process.env.STRIPE_WEBHOOK_SECRET = prev;
      });
  });
}

async function run() {
  let passed = 0;

  // 1. Valid signature accepts
  {
    const payload = JSON.stringify(buildPaidSessionEvent());
    const header = signStripePayload(payload, TEST_SECRET);
    assert.strictEqual(verifyStripeSignature(payload, header, TEST_SECRET), true);
    passed += 1;
    console.log('PASS verify: valid signature');
  }

  // 2. Tampered payload rejects
  {
    const payload = JSON.stringify(buildPaidSessionEvent());
    const header = signStripePayload(payload, TEST_SECRET);
    assert.strictEqual(verifyStripeSignature(payload + ' ', header, TEST_SECRET), false);
    passed += 1;
    console.log('PASS verify: tampered payload rejected');
  }

  // 3. Wrong secret rejects
  {
    const payload = JSON.stringify(buildPaidSessionEvent());
    const header = signStripePayload(payload, TEST_SECRET);
    assert.strictEqual(verifyStripeSignature(payload, header, 'whsec_wrong'), false);
    passed += 1;
    console.log('PASS verify: wrong secret rejected');
  }

  // 4. Stale timestamp rejects
  {
    const payload = JSON.stringify(buildPaidSessionEvent());
    const oldTs = Math.floor(Date.now() / 1000) - 600;
    const header = signStripePayload(payload, TEST_SECRET, oldTs);
    assert.strictEqual(verifyStripeSignature(payload, header, TEST_SECRET, 300), false);
    passed += 1;
    console.log('PASS verify: stale timestamp rejected');
  }

  // 5. Handler: paid session -> accepted
  {
    const payload = JSON.stringify(buildPaidSessionEvent());
    const header = signStripePayload(payload, TEST_SECRET);
    const result = await invokeHandler({ body: payload, signature: header, secret: TEST_SECRET });
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body.ok, true);
    assert.strictEqual(result.body.accepted, true);
    assert.strictEqual(result.body.event.fulfilment_state, 'PAID_PENDING_FULFILMENT');
    assert.strictEqual(result.body.event.offer_id, 'DREAMLEDGER-BILLBOARD-100X100-NZD29');
    assert.strictEqual(result.body.event.external_event_id, 'evt_test_billboard_paid_001');
    passed += 1;
    console.log('PASS handler: paid session accepted');
  }

  // 6. Handler: unpaid session -> not accepted
  {
    const payload = JSON.stringify(buildUnpaidSessionEvent());
    const header = signStripePayload(payload, TEST_SECRET);
    const result = await invokeHandler({ body: payload, signature: header, secret: TEST_SECRET });
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body.accepted, false);
    assert.strictEqual(result.body.reason, 'PAYMENT_NOT_PAID');
    passed += 1;
    console.log('PASS handler: unpaid session rejected');
  }

  // 7. Handler: invalid signature -> 400
  {
    const payload = JSON.stringify(buildPaidSessionEvent());
    const result = await invokeHandler({
      body: payload,
      signature: 't=1,v1=deadbeef',
      secret: TEST_SECRET
    });
    assert.strictEqual(result.statusCode, 400);
    assert.strictEqual(result.body.error, 'INVALID_STRIPE_SIGNATURE');
    passed += 1;
    console.log('PASS handler: invalid signature 400');
  }

  // 8. Handler: GET -> 405
  {
    const result = await invokeHandler({
      method: 'GET',
      body: '{}',
      signature: '',
      secret: TEST_SECRET
    });
    assert.strictEqual(result.statusCode, 405);
    passed += 1;
    console.log('PASS handler: method not allowed');
  }

  console.log('');
  console.log(`ALL ${passed} OFFLINE STRIPE WEBHOOK TESTS PASSED`);
  console.log('NOTE: This is not a live payment. VERIFIED REVENUE remains NZ$0 until Stripe reports paid.');
}

run().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
