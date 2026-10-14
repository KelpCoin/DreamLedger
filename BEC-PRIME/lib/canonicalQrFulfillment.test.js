'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CANONICAL_QR_URL, CANONICAL_QR_ASSET, canonicalQrFulfillment, customerQrHtml, printableInsertHtml } = require('./canonicalQrFulfillment');

test('canonical QR fulfillment metadata contains no buyer personal data', () => {
  const qr = canonicalQrFulfillment({ productId: 'CMD-DIAG-29', orderId: 'cs_test_abcdef', channel: 'mtg-diagnostic' });
  assert.equal(qr.asset_id, 'QR-CANONICAL-001');
  assert.equal(qr.canonical_url, CANONICAL_QR_URL);
  assert.equal(qr.image_url, CANONICAL_QR_ASSET);
  assert.equal(qr.product_id, 'CMD-DIAG-29');
  assert.equal(qr.order_reference, 'cs_test_abcdef');
  assert.equal(qr.placement_policy, 'include_in_every_customer_facing_fulfillment');
  assert.equal(JSON.stringify(qr).includes('@'), false);
});

test('digital and printable fulfillment snippets use the canonical first-party QR', () => {
  const digital = customerQrHtml({ productId: 'CMD-DIAG-29', orderId: 'order-1' });
  const printable = printableInsertHtml({ productId: 'SINGLE-1', orderId: 'order-2' });
  for (const output of [digital, printable]) {
    assert.ok(output.includes(CANONICAL_QR_URL));
    assert.ok(output.includes(CANONICAL_QR_ASSET));
    assert.ok(output.includes('Scan'));
    assert.ok(!output.includes('stripe.com'));
  }
});
