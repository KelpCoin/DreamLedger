'use strict';

const fs = require('fs');
const path = require('path');
const mapper = require('./lib/catalogueMapper');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const product = catalog.products.find((p) => mapper.isBillboardProductId(p.id));

function fail(message) {
  console.error('CATALOGUE_MAPPER_FAIL: ' + message);
  process.exit(1);
}

if (!product) fail('billboard product is missing from public catalogue');
if (product.checkout_available !== true) fail('billboard checkout is not enabled');
if (product.checkout_url !== mapper.BILLBOARD.payment_link_url) fail('catalogue checkout URL does not match canonical Payment Link');
if (product.price !== mapper.BILLBOARD.amount_nzd_cents / 100) fail('catalogue price does not match canonical amount');
if (mapper.normalizeBillboardProductId(product.id) !== mapper.BILLBOARD.product_id) fail('catalogue billboard id does not normalize to canonical product');
if (!mapper.matchesStripeLineItem({ price: { id: mapper.BILLBOARD.stripe_price_id, product: mapper.BILLBOARD.stripe_product_id } })) fail('verified Stripe product/price pair does not match mapper');

console.log('CATALOGUE_MAPPER_PASS');
console.log(JSON.stringify({
  catalogue_product_id: product.id,
  canonical_product_id: mapper.BILLBOARD.product_id,
  offer_id: mapper.BILLBOARD.offer_id,
  sku: mapper.BILLBOARD.sku,
  stripe_product_id: mapper.BILLBOARD.stripe_product_id,
  stripe_price_id: mapper.BILLBOARD.stripe_price_id,
  stripe_payment_link_id: mapper.BILLBOARD.stripe_payment_link_id
}, null, 2));
