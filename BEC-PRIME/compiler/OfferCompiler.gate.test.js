'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCanonicalOffer } = require('./OfferCompiler');

function fixtures(overrides = {}) {
  const record = {
    offer_id: 'OFFER-EXAMPLE-001',
    product_id: 'EXAMPLE-001',
    price: 29,
    currency: 'NZD',
    payment_link_url: 'https://buy.stripe.com/example',
    payment_link_status: 'ACTIVE_LIVEMODE',
    ...overrides.record
  };
  const product = {
    id: 'EXAMPLE-001',
    status: 'published',
    price: 29,
    currency: 'nzd',
    inventory: 1,
    checkout: { mode: 'payment_link', url: 'https://buy.stripe.com/example' },
    commercial_truth: {
      approval_required: false,
      sellable: true,
      payment_link: 'https://buy.stripe.com/example'
    },
    ...overrides.product
  };
  const fulfillment = {
    ready: true,
    operator_required: false,
    ...overrides.fulfillment
  };
  return { record, product, fulfillment };
}

test('only canonical published, sellable, link-matched products with ready zero-human fulfillment pass', () => {
  const { record, product, fulfillment } = fixtures();
  assert.deepEqual(evaluateCanonicalOffer(record, product, fulfillment), {
    allowed: true,
    reason: null,
    reasons: []
  });
});

test('held product cannot be reopened by an operator approval record or live provider-link label', () => {
  const { record, product, fulfillment } = fixtures({
    product: {
      status: 'review_required',
      commercial_truth: {
        approval_required: true,
        sellable: false,
        payment_link: null
      },
      checkout: { mode: 'disabled', url: null }
    }
  });
  const verdict = evaluateCanonicalOffer(record, product, fulfillment);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reasons.join(','), /canonical_product_not_published/);
  assert.match(verdict.reasons.join(','), /canonical_product_approval_required/);
  assert.match(verdict.reasons.join(','), /canonical_product_not_sellable/);
});

test('missing or operator-dependent fulfillment remains held', () => {
  const { record, product } = fixtures();
  assert.equal(evaluateCanonicalOffer(record, product, null).allowed, false);
  assert.equal(evaluateCanonicalOffer(record, product, { ready: true, operator_required: true }).allowed, false);
});

test('price, currency, payment-link and inventory drift fail closed', () => {
  let x = fixtures({ product: { price: 50 } });
  assert.match(evaluateCanonicalOffer(x.record, x.product, x.fulfillment).reason, /canonical_price_mismatch/);

  x = fixtures({ product: { currency: 'USD' } });
  assert.match(evaluateCanonicalOffer(x.record, x.product, x.fulfillment).reason, /canonical_currency_mismatch/);

  x = fixtures({ product: { checkout: { mode: 'payment_link', url: 'https://buy.stripe.com/other' } } });
  assert.match(evaluateCanonicalOffer(x.record, x.product, x.fulfillment).reason, /canonical_payment_link_mismatch/);

  x = fixtures({ product: { inventory: 0 } });
  assert.match(evaluateCanonicalOffer(x.record, x.product, x.fulfillment).reason, /canonical_inventory_unavailable/);
});

test('invalid direct payment URL or unverified provider status fails closed', () => {
  let x = fixtures({ record: { payment_link_url: 'javascript:alert(1)' }, product: { checkout: { mode: 'payment_link', url: 'javascript:alert(1)' }, commercial_truth: { approval_required: false, sellable: true, payment_link: 'javascript:alert(1)' } } });
  assert.match(evaluateCanonicalOffer(x.record, x.product, x.fulfillment).reason, /canonical_payment_link_invalid/);

  x = fixtures({ record: { payment_link_status: 'UNKNOWN' } });
  assert.match(evaluateCanonicalOffer(x.record, x.product, x.fulfillment).reason, /provider_link_not_verified_active/);
});
