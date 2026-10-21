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
  // Held products may be omitted entirely from the public sales catalogue.
  if (diagnostic) {
    assert.equal(diagnostic.status, 'held');
    assert.equal(diagnostic.checkout_available, false);
    assert.equal(Object.hasOwn(diagnostic, 'condition'), false);
  }
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

test('static root publication contains the manifest-driven MTG master paths', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  // The master and published views are independently composed. Enforce
  // provenance and publication gates, not byte equality of generated HTML.
  const master = json('data/mtg-catalog.json').products;
  const published = json('public/data/mtg-catalog.json').products;
  const knownIds = new Set(master.map(p => p.id));
  for (const p of published) {
    assert.ok(knownIds.has(p.id), p.id + ' must come from the MTG master');
    assert.equal(p.status, 'published', p.id + ' must be a published item');
    assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' is a deck, not a single card');
  }
  assert.ok(master.some(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001' && p.status === 'held'));
  assert.ok(!published.some(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001'), 'held diagnostic must not appear for purchase');
});
