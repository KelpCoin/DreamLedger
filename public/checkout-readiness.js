'use strict';

function isSafeStripeCheckoutUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'buy.stripe.com' &&
      /^\/[A-Za-z0-9]+$/.test(url.pathname) &&
      url.search === '' &&
      url.hash === '';
  } catch (_) {
    return false;
  }
}

function isPublicPurchaseReady(product) {
  if (!product || typeof product !== 'object') return false;
  return product.status === 'published' &&
    product.checkout_available === true &&
    product.commercial_truth &&
    product.commercial_truth.sellable === true &&
    product.delivery_test_status === 'PASS' &&
    product.commercial_validation_status === 'VALIDATED' &&
    product.availability !== 'review_required' &&
    !product.checkout_hold_reason &&
    isSafeStripeCheckoutUrl(product.checkout_url);
}

module.exports = { isPublicPurchaseReady, isSafeStripeCheckoutUrl };
