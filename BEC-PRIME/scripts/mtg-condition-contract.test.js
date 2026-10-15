'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));

test('Commander diagnostic is held and has no card condition or live checkout', () => {
  const p = json('BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
  assert.equal(p.status, 'held');
  assert.equal(p.inventory, 0);
  assert.equal(p.checkout.mode, 'disabled');
  assert.equal(p.commercial_truth.sellable, false);
  assert.equal(p.commercial_truth.approval_required, true);
  assert.equal(Object.hasOwn(p, 'condition'), false);
  assert.equal(Object.hasOwn(p.commercial_truth, 'payment_link'), false);
});

test('digital services and commander decks never inherit a card condition', () => {
  const mtg = json('public/data/mtg-catalog.json');
  const diagnostic = mtg.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.equal(diagnostic.status, 'held');
  assert.equal(diagnostic.checkout_available, false);
  assert.equal(Object.hasOwn(diagnostic, 'condition'), false);
  for (const p of mtg.products.filter(p => p.category === 'commander-deck' || p.category === 'digital-service')) {
    assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' must not carry a card condition');
  }
});

test('MTG renderer has no default Lightly Played condition', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  assert.equal(source.includes('LP− (Lightly Played)'), false);
  assert.equal(patch.includes('Condition not specified'), false);
  assert.match(source, /conditionEligible/);
  assert.match(patch, /conditionEligible/);
});

test('held Commander offer has no public purchase CTA or stale Stripe identifiers', () => {
  for (const rel of [
    'public/home.html',
    'public/index.html',
    'public/cash.html',
    'public/mtg/index.html',
    'public/mtg/master.html'
  ]) {
    const html = read(rel);
    assert.equal(html.includes('/buy/COMMANDER-DECK-DIAGNOSTIC-001'), false, rel + ' must not advertise held checkout');
    assert.equal(html.includes('eVqeVdc1T01n1DV3gwdwc30'), false, rel + ' must not expose the held Stripe link');
  }
  const catalog = json('public/catalog.json');
  const held = catalog.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.ok(held);
  assert.equal(held.status, 'held');
  assert.equal(held.checkout_available, false);
  assert.equal(Object.hasOwn(held, 'payment_link_id'), false);
  assert.equal(Object.hasOwn(held, 'stripe_price_id'), false);
  assert.equal(Object.hasOwn(held, 'checkout_url'), false);
});

test('diagnostic success route does not fabricate delivery evidence', () => {
  const page = read('public/thanks-diagnostic.html');
  assert.match(page, /Receipt verification required/);
  assert.match(page, /Not a delivery receipt/);
  assert.match(page, /currently held/i);
  assert.doesNotMatch(page, /Decklist received|write-up on the email used at checkout/i);
  assert.doesNotMatch(page, /buy\.stripe\.com|\/buy\/COMMANDER-DECK-DIAGNOSTIC-001/);
});

test('static root publication contains the manifest-driven MTG master paths', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  assert.equal(read('mtg/index.html'), read('public/mtg/index.html'));
  assert.equal(read('data/mtg-catalog.json'), read('public/data/mtg-catalog.json'));
});
