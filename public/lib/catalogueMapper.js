'use strict';

// Canonical public-to-Stripe mapping for the live DreamLedger Founding Tile.
// Legacy catalogue aliases remain accepted only as lookup inputs.
const BILLBOARD = Object.freeze({
  product_id: 'DREAMLEDGER-BILLBOARD-FOUNDING-001',
  offer_id: 'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001',
  sku: 'DL-BILLBOARD-100X100-3000-001',
  legacy_product_ids: ['BILLBOARD-LARGE', 'DREAMLEDGER-BILLBOARD-LARGE-001'],
  stripe_product_id: 'prod_VAib1Vp39cB8uZ',
  stripe_price_id: 'price_1UAN9uJt4ieIQDFzrCwtZetj',
  stripe_payment_link_id: 'plink_1UAN9zJt4ieIQDFzgHeso6Qo',
  payment_link_url: 'https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02',
  amount_nzd_cents: 5000,
  dimensions: '100x100'
});

function isBillboardProductId(value) {
  return value === BILLBOARD.product_id || BILLBOARD.legacy_product_ids.includes(value);
}

function normalizeBillboardProductId(value) {
  return isBillboardProductId(value) ? BILLBOARD.product_id : value;
}

function matchesStripeLineItem(lineItem) {
  return Boolean(lineItem && lineItem.price &&
    lineItem.price.id === BILLBOARD.stripe_price_id &&
    lineItem.price.product === BILLBOARD.stripe_product_id);
}

module.exports = Object.freeze({
  BILLBOARD,
  isBillboardProductId,
  normalizeBillboardProductId,
  matchesStripeLineItem
});
