'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compileApprovedOffers,
  loadCapabilities,
  loadApprovedOffers
} = require('./OfferCompiler');

test('operator approval cannot override a closed canonical product gate', () => {
  const result = compileApprovedOffers(loadApprovedOffers(), loadCapabilities(), []);
  assert.equal(result.errors.length, 0);
  assert.ok(result.approved.length > 0);

  for (const offer of result.approved) {
    if (offer.status === 'HELD_CANONICAL_PRODUCT_GATE') {
      assert.equal(offer.approval_required, true, offer.offer_id);
      assert.equal(offer.checkout_available, false, offer.offer_id);
      assert.equal(offer.payment_link_url, null, offer.offer_id);
      assert.equal(offer.fulfillment_route, null, offer.offer_id);
    } else {
      assert.equal(offer.status, 'VERIFIED_AVAILABLE', offer.offer_id);
      assert.equal(offer.approval_required, false, offer.offer_id);
      assert.equal(offer.checkout_available, true, offer.offer_id);
    }
  }

  const commander = result.approved.find(x => x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
  assert.ok(commander);
  assert.equal(commander.status, 'HELD_CANONICAL_PRODUCT_GATE');
  assert.equal(commander.checkout_available, false);
  assert.equal(commander.payment_link_url, null);

  const billboard = result.approved.find(x => x.offer_id === 'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001');
  assert.ok(billboard);
  assert.equal(billboard.status, 'HELD_CANONICAL_PRODUCT_GATE');
  assert.equal(billboard.approval_required, true);
  assert.equal(billboard.checkout_available, false);
  assert.equal(billboard.payment_link_url, null);
  assert.equal(billboard.fulfillment_route, null);
});
