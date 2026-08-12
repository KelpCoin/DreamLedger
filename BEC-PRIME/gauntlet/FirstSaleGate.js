'use strict';

function check(product) {
  const p = product || {};
  const checks = {
    id: p.id === 'EDH_0001',
    published: p.status === 'published',
    approved: p.commercial_truth?.approval_required === false,
    checkout_mode: p.checkout?.mode === 'payment',
    inventory: Number(p.inventory) > 0,
    price: Number(p.price) === 40000,
    currency: String(p.currency || '').toLowerCase() === 'nzd',
    payment_surface: p.commercial_truth?.payment_surface === 'engine-generated-stripe-checkout'
  };
  return {
    schema: 'BEC-FIRST-SALE-GATE-1.0',
    asset_id: p.id || null,
    verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    checks,
    reason: Object.values(checks).every(Boolean) ? 'EDH_0001 is eligible for buyer-initiated checkout.' : 'First-sale gate rejected the product.'
  };
}

module.exports = { check };
