'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildOfferParityReceipt,
  metadataIdentityMatches,
  nzdToMinor
} = require('../economic/StripePaymentLinkResolver');

function fixture() {
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
  const link = {
    id: 'plink_livecanonical',
    url: 'https://buy.stripe.com/canonical',
    active: true,
    livemode: true,
    metadata: {
      offer_id: 'OFFER-CMD-DIAG-29-NZD',
      product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
      sku: 'CMD-DIAG-29'
    }
  };
  return {
    offer,
    liveOffer: {
      offer_id: 'OFFER-CMD-DIAG-29-NZD',
      price_nzd: 29,
      checkout: 'https://buy.stripe.com/canonical',
      status: 'ACTIVE_LIVEMODE',
      silo: 'mtg'
    },
    publicProduct: {
      id: 'COMMANDER-DECK-DIAGNOSTIC-001',
      sku: 'CMD-DIAG-29',
      name: 'Commander Deck Diagnostic',
      price: 29,
      currency: 'nzd',
      status: 'published',
      checkout_available: true,
      checkout_url: 'https://buy.stripe.com/canonical'
    },
    stripeLinks: [link],
    lineItemsByLinkId: {
      plink_livecanonical: [{
        quantity: 1,
        price: { id: 'price_29', unit_amount: 2900, currency: 'nzd', recurring: null }
      }]
    },
    apiMode: 'live',
    fulfillmentEntry: { ready: true, operator_required: false, type: 'digital_report' },
    publicPage: {
      route: '/mtg/',
      source_path: 'public/mtg/index.html',
      purchase_route: '/buy/commander-deck-diagnostic-001/',
      displayed_amount_nzd: 29,
      checkout_held: false
    }
  };
}

function receipt(changes = {}) {
  return buildOfferParityReceipt({ ...fixture(), ...changes });
}

function assertBlocker(result, prefix) {
  assert.ok(result.blocker_codes.some(code => code === prefix || code.startsWith(prefix + ':')),
    'Expected blocker ' + prefix + ', got: ' + JSON.stringify(result.blocker_codes));
}

test('synthetic clean offer controls remain coherent and revenue-neutral', () => {
  const controls = [
    { price: 29, currency: 'NZD' },
    { price: 4.99, currency: 'NZD' },
    { price: 19, currency: 'NZD' },
    { price: 49, currency: 'NZD' },
    { price: 5, currency: 'NZD' },
    { price: 100, currency: 'NZD' },
    { price: 0.5, currency: 'NZD' },
    { price: 12.34, currency: 'NZD' },
    { price: 250, currency: 'NZD' },
    { price: 79, currency: 'NZD' },
    { price: 29, currency: 'nzd' },
    { price: 49, currency: 'nzd' },
    { price: 5, currency: 'nzd' },
    { price: 100, currency: 'nzd' },
    { price: 0.5, currency: 'nzd' },
    { price: 12.34, currency: 'nzd' },
    { price: 250, currency: 'nzd' },
    { price: 79, currency: 'nzd' },
    { price: 19, currency: 'nzd' },
    { price: 4.99, currency: 'nzd' }
  ];
  for (const [i, ctrl] of controls.entries()) {
    const f = fixture();
    const id = 'CLEAN-' + i;
    const amount = nzdToMinor(ctrl.price);
    Object.assign(f.offer, {
      offer_id: id,
      product_id: 'PRODUCT-' + i,
      product_sku: 'SKU-' + i,
      price: ctrl.price,
      currency: ctrl.currency
    });
    Object.assign(f.liveOffer, {
      offer_id: id,
      price_nzd: ctrl.price,
      silo: 'mtg'
    });
    Object.assign(f.publicProduct, {
      id: 'PRODUCT-' + i,
      sku: 'SKU-' + i,
      price: ctrl.price,
      currency: ctrl.currency,
      status: 'published',
      checkout_available: true
    });
    f.offer.currency = 'NZD';
    f.publicProduct.currency = 'nzd';
    f.offer.payment_link_url = 'https://buy.stripe.com/clean-' + i;
    f.liveOffer.checkout = f.offer.payment_link_url;
    f.publicProduct.checkout_url = f.offer.payment_link_url;
    f.stripeLinks[0].url = f.offer.payment_link_url;
    f.stripeLinks[0].metadata = {
      offer_id: id,
      product_id: 'PRODUCT-' + i,
      sku: 'SKU-' + i
    };
    f.lineItemsByLinkId.plink_livecanonical[0].price.unit_amount = amount;
    f.publicPage.displayed_amount_nzd = ctrl.price;
    const r = buildOfferParityReceipt(f);
    assert.equal(r.coherent, true, 'clean control ' + i + ': ' + JSON.stringify(r.blocker_codes));
    assert.equal(r.verified_revenue_nzd, 0);
    assert.equal(r.revenue_claim_permitted, false);
  }
});

test('a one-surface URL drift is rejected', () => {
  const f = fixture();
  f.liveOffer.checkout = 'https://buy.stripe.com/other';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'CHECKOUT_URL_DIVERGENCE_ACROSS_CATALOGUES');
  assertBlocker(r, 'STRIPE_PAYMENT_LINK_NOT_FOUND_BY_EXACT_URL');
});

test('all three catalogue surfaces must use the identical checkout URL', () => {
  for (const surface of ['approved', 'public']) {
    const f = fixture();
    if (surface === 'approved') f.offer.payment_link_url = 'https://buy.stripe.com/alternate';
    else f.publicProduct.checkout_url = 'https://buy.stripe.com/alternate';
    const r = buildOfferParityReceipt(f);
    assert.equal(r.coherent, false, surface);
    assertBlocker(r, 'CHECKOUT_URL_DIVERGENCE_ACROSS_CATALOGUES');
  }
});

test('live checkout status must agree with live provider mode', () => {
  const f = fixture();
  f.liveOffer.status = 'INACTIVE_LIVEMODE';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'LIVE_COMMERCE_NOT_MARKED_ACTIVE_LIVEMODE');
});

test('live commerce price drift is rejected', () => {
  const f = fixture();
  f.liveOffer.price_nzd = 49;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'LIVE_COMMERCE_PRICE_MISMATCH');
});

test('public product cannot claim a non-published product is sellable', () => {
  const f = fixture();
  f.publicProduct.status = 'held';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'PUBLIC_PRODUCT_NOT_PUBLISHED');
});

test('public checkout availability is a hard invariant', () => {
  const f = fixture();
  f.publicProduct.checkout_available = false;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'PUBLIC_CHECKOUT_NOT_AVAILABLE');
});

test('public price and currency copy must match the approved offer', () => {
  const price = fixture();
  price.publicProduct.price = 49;
  assertBlocker(buildOfferParityReceipt(price), 'PUBLIC_COPY_PRICE_MISMATCH');
  const currency = fixture();
  currency.publicProduct.currency = 'usd';
  assertBlocker(buildOfferParityReceipt(currency), 'PUBLIC_COPY_CURRENCY_MISMATCH');
});

test('rendered page price is checked separately from catalogue prices', () => {
  const f = fixture();
  f.publicPage.displayed_amount_nzd = 49;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'PUBLIC_PAGE_PRICE_MISMATCH');
});

test('rendered purchase route is mandatory evidence', () => {
  const f = fixture();
  f.publicPage.purchase_route = null;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'PUBLIC_PAGE_PURCHASE_ROUTE_MISSING');
});

test('missing public-page evidence is not inferred from catalogues', () => {
  const r = receipt({ publicPage: null });
  assert.equal(r.coherent, false);
  assertBlocker(r, 'PUBLIC_PAGE_EVIDENCE_MISSING');
});

test('the public purchase route cannot be held while the offer is counted coherent', () => {
  const f = fixture();
  f.publicPage.checkout_held = true;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'PUBLIC_PURCHASE_ROUTE_HELD');
});

test('missing live provider object fails closed instead of trusting the URL slug', () => {
  const f = fixture();
  f.stripeLinks = [];
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_PAYMENT_LINK_NOT_FOUND_BY_EXACT_URL');
  assertBlocker(r, 'NO_STRIPE_LINK_MATCHES_OFFER_METADATA');
});

test('a link with a different offer ID cannot be pinned by matching price, product and SKU', () => {
  const f = fixture();
  f.stripeLinks[0].metadata.offer_id = 'OFFER-OTHER';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_METADATA_DOES_NOT_IDENTIFY_APPROVED_OFFER');
  assertBlocker(r, 'NO_STRIPE_LINK_MATCHES_OFFER_METADATA');
});

test('a link for a different product cannot be pinned by matching offer ID and SKU', () => {
  const f = fixture();
  f.stripeLinks[0].metadata.product_id = 'PRODUCT-OTHER';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_METADATA_DOES_NOT_IDENTIFY_APPROVED_OFFER');
});

test('a link for a different SKU cannot be pinned by matching offer ID and product ID', () => {
  const f = fixture();
  f.stripeLinks[0].metadata.sku = 'SKU-OTHER';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_METADATA_DOES_NOT_IDENTIFY_APPROVED_OFFER');
});

test('missing provider metadata is a blocker even when the amount matches', () => {
  const f = fixture();
  f.stripeLinks[0].metadata = {};
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_METADATA_DOES_NOT_IDENTIFY_APPROVED_OFFER');
});

test('two active links for the same offer and price are ambiguous, not coherent', () => {
  const f = fixture();
  const second = structuredClone(f.stripeLinks[0]);
  second.id = 'plink_second_active';
  second.url = 'https://buy.stripe.com/second';
  f.stripeLinks.push(second);
  f.lineItemsByLinkId.plink_second_active = structuredClone(f.lineItemsByLinkId.plink_livecanonical);
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'MULTIPLE_ACTIVE_STRIPE_LINKS_MATCH_OFFER_IDENTITY_AND_PRICE');
});

test('zero-priced configuration is not counted as a paid revenue offer', () => {
  const f = fixture();
  f.offer.price = 0;
  f.liveOffer.price_nzd = 0;
  f.publicProduct.price = 0;
  f.publicPage.displayed_amount_nzd = 0;
  f.lineItemsByLinkId.plink_livecanonical[0].price.unit_amount = 0;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_OFFER_AMOUNT_MUST_BE_POSITIVE');
});

test('null or blank prices cannot collapse into zero', () => {
  assert.equal(nzdToMinor(null), null);
  assert.equal(nzdToMinor(undefined), null);
  assert.equal(nzdToMinor(''), null);
  assert.equal(nzdToMinor(-1), null);
  const f = fixture();
  f.offer.price = null;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_AMOUNT_MINOR_MISMATCH');
});

test('missing line items do not create a zero-price link', () => {
  const f = fixture();
  f.lineItemsByLinkId = {};
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_PAYMENT_LINK_HAS_NO_RESOLVABLE_LINE_ITEMS');
  assertBlocker(r, 'STRIPE_LINE_ITEM_AMOUNT_OR_CURRENCY_UNRESOLVED');
});

test('unknown line-item amount is a blocker even if the object exists', () => {
  const f = fixture();
  f.lineItemsByLinkId.plink_livecanonical[0].price.unit_amount = null;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_LINE_ITEM_AMOUNT_OR_CURRENCY_UNRESOLVED');
});

test('zero quantity cannot erase a line-item amount guard', () => {
  const f = fixture();
  f.lineItemsByLinkId.plink_livecanonical[0].quantity = 0;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_LINE_ITEM_AMOUNT_OR_CURRENCY_UNRESOLVED');
});

test('conflicting line-item currencies are rejected', () => {
  const f = fixture();
  f.lineItemsByLinkId.plink_livecanonical.push({
    quantity: 1,
    price: { id: 'price_other', unit_amount: 100, currency: 'usd', recurring: null }
  });
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_LINE_ITEM_CURRENCY_CONFLICT');
});

test('recurring price is not accepted for a one-time offer', () => {
  const f = fixture();
  f.lineItemsByLinkId.plink_livecanonical[0].price.recurring = { interval: 'month' };
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'UNEXPECTED_RECURRING_PRICE_ON_ONE_TIME_OFFER');
});

test('inactive provider object is rejected even when its amount matches', () => {
  const f = fixture();
  f.stripeLinks[0].active = false;
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_PAYMENT_LINK_INACTIVE');
});

test('test-mode API access is rejected for the live offer', () => {
  const r = receipt({ apiMode: 'test' });
  assert.equal(r.coherent, false);
  assertBlocker(r, 'STRIPE_API_KEY_NOT_LIVE');
});

test('fulfillment record is required', () => {
  const r = receipt({ fulfillmentEntry: null });
  assert.equal(r.coherent, false);
  assertBlocker(r, 'FULFILLMENT_REGISTRY_ENTRY_MISSING');
});

test('unready fulfillment record is rejected', () => {
  const r = receipt({ fulfillmentEntry: { ready: false, operator_required: false } });
  assert.equal(r.coherent, false);
  assertBlocker(r, 'FULFILLMENT_REGISTRY_NOT_READY');
});

test('operator-required fulfillment is not automatically sellable', () => {
  const r = receipt({ fulfillmentEntry: { ready: true, operator_required: true } });
  assert.equal(r.coherent, false);
  assertBlocker(r, 'FULFILLMENT_REQUIRES_OPERATOR');
});

test('fulfillment route and delivery-proof contract are required', () => {
  const f1 = fixture();
  f1.offer.fulfillment_route = '';
  assertBlocker(buildOfferParityReceipt(f1), 'FULFILLMENT_ROUTE_MISSING');
  const f2 = fixture();
  f2.offer.proof_of_delivery = '';
  assertBlocker(buildOfferParityReceipt(f2), 'DELIVERY_PROOF_CONTRACT_MISSING');
});

test('silo mismatch is rejected', () => {
  const f = fixture();
  f.liveOffer.silo = 'dreammeez';
  const r = buildOfferParityReceipt(f);
  assert.equal(r.coherent, false);
  assertBlocker(r, 'LIVE_COMMERCE_SILO_MISMATCH');
});

console.log('777_STRIPE_RESOLVER_ADVERSARIAL=PASS');
