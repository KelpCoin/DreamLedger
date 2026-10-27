'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = require(path.join(root, 'BEC-PRIME/catalog/offers/approved.json'));
const html = fs.readFileSync(path.join(root, 'public/billboard.html'), 'utf8');
function offer(id) { return data.approved.find(x => x.offer_id === id); }
test('Existing NZD 50 founding billboard uses provider-confirmed identifiers', () => {
  const item = offer('OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001');
  assert.ok(item);
  assert.equal(item.payment_link_id, 'plink_1U9JGTEGgEAnUFF9WRg3CKk3');
  assert.equal(item.payment_link_url, 'https://buy.stripe.com/00w4gz6HzeWhcizeZedwc2w');
  assert.equal(item.currency, 'NZD');
  assert.equal(item.price, 50);
  assert.equal(item.product_id, 'DREAMLEDGER-BILLBOARD-FOUNDING-001');
  assert.equal(item.product_sku, 'DL-BILLBOARD-100X100-3000-001');
});
test('Billboard page describes only the live Payment Link fields and review gate', () => {
  assert.match(html, /This NZ\$50 link does not collect an image URL/);
  assert.match(html, /billboard label/);
  assert.match(html, /destination URL can be added optionally/);
  assert.match(html, /require content review and verified delivery/);
  assert.doesNotMatch(html, /optional image URL in secure Stripe checkout/);
});
test('Provider-inactive MTG direct link is never claimed active', () => {
  const item = offer('OFFER-CMD-DIAG-29-NZD');
  assert.ok(item);
  assert.equal(item.payment_link_id, 'plink_1UKS00EGgEAnUFF9kUjraaL5');
  assert.equal(item.payment_link_status, 'INACTIVE_LIVEMODE');
  assert.equal(item.price, 29);
  assert.equal(item.currency, 'NZD');
});
test('No new offer or hidden price change', () => {
  assert.deepEqual(data.approved.map(o => o.offer_id).sort(), [
    'OFFER-CMD-DIAG-29-NZD', 'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001'
  ].sort());
  assert.equal(offer('OFFER-CMD-DIAG-29-NZD').price, 29);
  assert.equal(offer('OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001').price, 50);
});
