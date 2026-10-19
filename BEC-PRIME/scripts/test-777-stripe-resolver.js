'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildOfferParityReceipt, inspectStripeLink, nzdToMinor } = require('../economic/StripePaymentLinkResolver');

function fixture(overrides = {}) {
  const offer = {
    offer_id: 'OFFER-CMD-DIAG-29-NZD',
    product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
    product_sku: 'CMD-DIAG-29',
    silo: 'mtg',
    price: 29,
    currency: 'NZD',
    payment_link_url: 'https://buy.stripe.com/canonical',
    fulfillment_route: '/mtg/diagnostic',
    proof_of_delivery: 'settled payment + report artifact + ledger event'
  };
  const liveOffer = {
    offer_id: 'OFFER-CMD-DIAG-29-NZD',
    price_nzd: 29,
    checkout: 'https://buy.stripe.com/canonical',
    status: 'ACTIVE_LIVEMODE',
    silo: 'mtg'
  };
  const publicProduct = {
    id: 'COMMANDER-DECK-DIAGNOSTIC-001',
    sku: 'CMD-DIAG-29',
    name: 'Commander Deck Diagnostic',
    price: 29,
    currency: 'nzd',
    status: 'published',
    checkout_available: true,
    checkout_url: 'https://buy.stripe.com/canonical'
  };
  const link = {
    id: 'plink_livecanonical',
    url: 'https://buy.stripe.com/canonical',
    active: true,
    metadata: {
      offer_id: 'OFFER-CMD-DIAG-29-NZD',
      product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
      sku: 'CMD-DIAG-29'
    }
  };
  return {
    offer, liveOffer, publicProduct,
    stripeLinks: [link],
    lineItemsByLinkId: { plink_livecanonical: [{
      quantity: 1,
      price: { id: 'price_29', unit_amount: 2900, currency: 'nzd', recurring: null }
    }] },
    apiMode: 'live',
    fulfillmentEntry: { ready: true, operator_required: false, type: 'digital_report' },
    publicPage: { route: '/mtg/', source_path: 'public/mtg/index.html', displayed_amount_nzd: 29, checkout_held: false },
    ...overrides
  };
}

test('resolves one exact active live-mode Stripe link with matching amount, currency and offer identity', () => {
  const r = buildOfferParityReceipt(fixture());
  assert.equal(r.coherent, true);
  assert.equal(r.expected.amount_minor, 2900);
  assert.equal(r.surfaces.stripe_provider.canonical_candidate.stripe_payment_link_id, 'plink_livecanonical');
  assert.equal(r.verified_revenue_nzd, 0);
  assert.equal(r.revenue_claim_permitted, false);
  assert.equal(r.external_action, 'NONE');
});

test('rejects inactive links even when the URL and price match', () => {
  const f = fixture();
  f.stripeLinks[0].active = false;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assert.ok(r.blocker_codes.includes('STRIPE_PAYMENT_LINK_INACTIVE:https://buy.stripe.com/canonical'));
});

test('rejects test-mode credentials for a production offer', () => {
  const r = buildOfferParityReceipt(fixture({ apiMode: 'test' }));
  assert.equal(r.coherent, false);
  assert.ok(r.blocker_codes.includes('STRIPE_API_KEY_NOT_LIVE:https://buy.stripe.com/canonical'));
});

test('rejects amount drift between copy and the real Stripe Price object', () => {
  const f = fixture();
  f.lineItemsByLinkId.plink_livecanonical[0].price.unit_amount = 4900;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assert.ok(r.blocker_codes.includes('STRIPE_AMOUNT_MINOR_MISMATCH:https://buy.stripe.com/canonical'));
});

test('rejects metadata mapped to a different product even when the URL responds', () => {
  const f = fixture();
  f.stripeLinks[0].metadata.sku = 'OTHER-SKU';
  f.stripeLinks[0].metadata.product_id = 'OTHER-PRODUCT';
  f.stripeLinks[0].metadata.offer_id = 'OTHER-OFFER';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assert.ok(r.blocker_codes.includes('STRIPE_METADATA_DOES_NOT_IDENTIFY_APPROVED_OFFER:https://buy.stripe.com/canonical'));
});

test('finds an active provider link by offer metadata when catalogue URLs are stale, but still blocks divergent surfaces', () => {
  const f = fixture();
  f.liveOffer.checkout = 'https://buy.stripe.com/old-inactive';
  f.publicProduct.checkout_url = null;
  f.stripeLinks.push({
    id: 'plink_old',
    url: 'https://buy.stripe.com/old-inactive',
    active: false,
    metadata: { offer_id: 'OFFER-CMD-DIAG-29-NZD', sku: 'CMD-DIAG-29' }
  });
  f.lineItemsByLinkId.plink_old = [{
    quantity: 1,
    price: { id: 'price_old', unit_amount: 2900, currency: 'nzd', recurring: null }
  }];
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assert.equal(r.surfaces.stripe_provider.unique_active_identity_and_price_matches, 1);
  assert.ok(r.blocker_codes.includes('CHECKOUT_URL_DIVERGENCE_ACROSS_CATALOGUES'));
  assert.ok(r.blocker_codes.includes('PUBLIC_CATALOGUE_CHECKOUT_URL_MISSING'));
});

test('the expected price conversion uses major NZD to cents', () => {
  assert.equal(nzdToMinor(29), 2900);
  assert.equal(nzdToMinor(4.99), 499);
  assert.equal(nzdToMinor(-1), null);
});

console.log('777_STRIPE_OFFER_RESOLVER_TESTS=PASS');
