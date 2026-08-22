'use strict';

function check(product) {
  const p = product || {};
  const paymentSurface = String(p.commercial_truth?.payment_surface || '').toLowerCase();
  const paymentLink = String(p.commercial_truth?.payment_link || p.commercial_truth?.payment_link_url || '');
  const checks = {
    id_present: Boolean(p.id),
    published: p.status === 'published',
    approved: p.commercial_truth?.approval_required === false,
    checkout_mode: p.checkout?.mode === 'payment',
    inventory: Number(p.inventory) > 0,
    price_positive: Number(p.price) > 0,
    currency: String(p.currency || '').toLowerCase() === 'nzd',
    payment_surface: paymentSurface === 'engine-generated-stripe-checkout' || paymentSurface === 'stripe-payment-link' || paymentSurface === 'stripe-checkout',
    payment_link_valid: paymentSurface === 'stripe-payment-link' ? /^https:\/\/buy\.stripe\.com\//.test(paymentLink) : true
  };
  const verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  return {
    schema: 'BEC-FIRST-SALE-GATE-2.0',
    asset_id: p.id || null,
    verdict,
    checks,
    reason: verdict === 'PASS' ? `${p.id} is eligible for buyer-initiated checkout at NZD ${Number(p.price)}.` : 'First-sale gate rejected the product.'
  };
}

module.exports = { check };
