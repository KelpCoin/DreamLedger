'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCommerceSku, resolveCommerceSilo } = require('./commercialCell');

test('normalizes the live CMD-DIAG-29 Payment Link to the canonical diagnostic SKU', () => {
  const metadata = {
    dreamledger_sku: 'CMD-DIAG-29',
    sku_id: 'CMD-DIAG-29',
    offer_id: 'OFFER-COMMANDER-DECK-DIAGNOSTIC-001',
    marketplace_listing_id: '2d379643-bbb6-40c6-bea4-1bcf915ba9de'
  };
  assert.equal(normalizeCommerceSku(metadata), 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.equal(resolveCommerceSilo(metadata, metadata.marketplace_listing_id), 'mtg');
});

test('preserves canonical SKU identity', () => {
  assert.equal(normalizeCommerceSku({ dreamledger_sku: 'COMMANDER-DECK-DIAGNOSTIC-001' }), 'COMMANDER-DECK-DIAGNOSTIC-001');
});

test('accepts sku_id when primary metadata aliases are absent', () => {
  assert.equal(normalizeCommerceSku({ sku_id: 'CMD-DIAG-29' }), 'COMMANDER-DECK-DIAGNOSTIC-001');
});

test('preserves an explicit silo and defaults listing-backed orders to MTG', () => {
  assert.equal(resolveCommerceSilo({ silo: 'creator' }, 'listing-1'), 'creator');
  assert.equal(resolveCommerceSilo({}, 'listing-1'), 'mtg');
  assert.equal(resolveCommerceSilo({}, ''), 'dreamledger');
});

test('unknown metadata remains unrecognized instead of inventing a SKU', () => {
  assert.equal(normalizeCommerceSku({ sku: 'UNKNOWN-PRODUCT' }), 'UNKNOWN-PRODUCT');
  assert.equal(normalizeCommerceSku({}), '');
});
