'use strict';
const assert = require('node:assert/strict');
const { isPublicPurchaseReady, isSafeStripeCheckoutUrl } = require('../public/checkout-readiness');

const good = {
  id: 'TEST-READY',
  status: 'published',
  checkout_available: true,
  checkout_url: 'https://buy.stripe.com/7sY3cv9TL9BXaar5oEdwc3n',
  commercial_truth: { sellable: true },
  delivery_test_status: 'PASS',
  commercial_validation_status: 'VALIDATED',
  availability: 'available'
};
assert.equal(isPublicPurchaseReady(good), true, 'fully verified fixture may pass');
assert.equal(isPublicPurchaseReady(null), false, 'null product must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, status: 'held' }), false, 'held product must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, checkout_available: false }), false, 'disabled checkout must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, commercial_truth: { sellable: false } }), false, 'unsellable product must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, commercial_truth: {} }), false, 'missing positive sellability must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, delivery_test_status: 'UNVERIFIED' }), false, 'unverified delivery must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, delivery_test_status: undefined }), false, 'missing delivery test must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, commercial_validation_status: 'UNVALIDATED' }), false, 'unvalidated offer must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, availability: 'review_required' }), false, 'review-required offer must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, checkout_hold_reason: 'hold' }), false, 'explicit hold must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, checkout_url: 'http://buy.stripe.com/abc' }), false, 'HTTP must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, checkout_url: 'https://evil.example/abc' }), false, 'non-Stripe host must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, checkout_url: 'https://buy.stripe.com/abc?redirect=evil' }), false, 'query strings must fail closed');
assert.equal(isPublicPurchaseReady({ ...good, checkout_url: 'https://buy.stripe.com/abc#fragment' }), false, 'fragments must fail closed');
assert.equal(isSafeStripeCheckoutUrl('https://buy.stripe.com/abc'), true);
assert.equal(isSafeStripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_123'), false);
console.log('CHECKOUT_READINESS_PASS=1');
console.log('CHECKOUT_READINESS_NEGATIVE_CASES=15');
console.log('CHECKOUT_READINESS_RULE=POSITIVE_EVIDENCE_REQUIRED');
