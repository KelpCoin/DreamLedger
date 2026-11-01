'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {staticMtgTemplateProfile} = require('./Patch-MTG-CommerceSurface');

const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const legacy = read('BEC-PRIME/website/mtg-catalog.html');
const free = read('public/mtg/index.html');

test('current compiler source is a non-commerce static MTG catalogue', () => {
  assert.equal(staticMtgTemplateProfile(legacy), 'catalogue-only');
  assert.doesNotMatch(legacy, /\/api\/offer-checkout\/create|buy\.stripe\.com/i);
});
test('free-first phone carousel is independently recognized', () => {
  assert.equal(staticMtgTemplateProfile(free), 'free-first');
  assert.equal((free.match(/class="hub-free-card"/g) || []).length, 5);
  assert.equal((free.match(/data-auction-slot="/g) || []).length, 3);
});
test('unknown template fails closed instead of receiving legacy checkout', () => {
  assert.equal(staticMtgTemplateProfile('<html><div id="catalog"></div></html>'), null);
  assert.equal(staticMtgTemplateProfile(legacy.replace('data-silo="mtg"', 'data-silo="other"')), null);
});
test('checkout activation cannot hide inside static template', () => {
  for (const attack of [
    '<a href="https://buy.stripe.com/active">Pay</a>',
    '<form action="/api/offer-checkout/create"></form>',
    '<script>window.location.assign(checkout_url)</script>',
    '<p>Payment received</p>'
  ]) assert.equal(staticMtgTemplateProfile(legacy + attack), null, attack);
});
test('missing or duplicated auction slot fails closed', () => {
  assert.equal(staticMtgTemplateProfile(legacy.replace('data-auction-slot="3"', 'data-auction-removed="3"')), null);
  assert.equal(staticMtgTemplateProfile(legacy + '<div data-auction-slot="4"></div>'), null);
});
test('free-first profile cannot silently lose its carousel', () => {
  assert.equal(staticMtgTemplateProfile(free.replace('class="hub-free-card"', 'class="hub-card"')), null);
  assert.equal(staticMtgTemplateProfile(free.replace('id="welcome"', 'id="other"')), null);
});
