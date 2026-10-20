'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateSource, reconcileProducts } = require('./verify-mtg-public-contract');

const ROOT = path.resolve(__dirname, '..');
const source = evaluateSource(ROOT);

test('MTG source contract passes without enabling checkout or claiming production', () => {
  assert.equal(source.status, 'PASS_SOURCE_CONTRACT_ONLY',
    JSON.stringify(source.checks.filter(check => !check.pass), null, 2));
  assert.equal(source.production_status, 'NOT_PROBED');
  assert.equal(source.verified_external_revenue_nzd, 0);
  assert.equal(source.production_mutated, false);
  assert.equal(source.candidate_silos_changed, 0);
});

test('canonical MTG routes serve the catalogue directly, not the redirect loop', () => {
  const server = fs.readFileSync(path.join(ROOT, 'public/server.js'), 'utf8');
  const page = fs.readFileSync(path.join(ROOT, 'public/mtg/index.html'), 'utf8');
  assert.match(server, /['"]\/mtg['"]\s*:\s*['"]mtg\/index\.html['"]/);
  assert.match(server, /['"]\/mtg\/['"]\s*:\s*['"]mtg\/index\.html['"]/);
  assert.match(page, /name=["']dreamledger-mtg-contract["']\s+content=["']v1["']/);
  assert.doesNotMatch(page, /http-equiv\s*=\s*["']refresh["']/i);
  assert.ok(page.includes("fetch('/api/products'"));
});

test('catalogue reconciliation admits only the two matched physical listings', () => {
  const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/mtg-catalog.json'), 'utf8'));
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/catalog.json'), 'utf8'));
  const result = reconcileProducts(feed, live);
  assert.deepEqual(result.eligible.map(item => item.id), [
    'EDH_QUINTORIUS_0002',
    'EDH_DWYNEN_0003'
  ]);
  assert.ok(result.eligible.every(item => item.mode === 'manual_enquiry'));
  assert.ok(result.eligible.every(item => item.checkout_available === false));
  assert.ok(result.quarantined.some(item => item.id === 'EDH_0001'));
  assert.ok(result.quarantined.some(item => item.id === 'EDH_JON_IRENICUS_0004'));
});

test('diagnostic remains visibly held and cannot be purchased through the MTG page', () => {
  const canonical = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'), 'utf8'));
  const aggregate = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/catalog.json'), 'utf8'));
  const publicProduct = aggregate.products.find(item => item.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  const page = fs.readFileSync(path.join(ROOT, 'public/mtg/index.html'), 'utf8');

  assert.equal(canonical.status, 'held');
  assert.equal(canonical.inventory, 0);
  assert.equal(canonical.checkout.mode, 'disabled');
  assert.equal(canonical.commercial_truth.sellable, false);
  assert.equal(publicProduct.status, 'held');
  assert.equal(publicProduct.checkout_available, false);
  assert.equal(publicProduct.checkout_url, undefined);
  assert.ok(page.includes('Commander Deck Diagnostic: currently held'));
  assert.ok(!page.includes('/buy/COMMANDER-DECK-DIAGNOSTIC-001'));
  assert.doesNotMatch(page, /https:\/\/buy\.stripe\.com\//);
});

test('deployment version exposes its immutable commit without mutating production', () => {
  const server = fs.readFileSync(path.join(ROOT, 'public/server.js'), 'utf8');
  assert.match(server, /commit:COMMIT/);
  assert.ok(source.checks.every(check => check.pass));
});
