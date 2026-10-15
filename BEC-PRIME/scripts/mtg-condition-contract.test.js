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
  assert.doesNotMatch(source, /buy\\.stripe\\.com/);
  assert.match(source, /Diagnostic currently held/);
});

test('static root publication contains the manifest-driven MTG master paths', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  const preview = read('mtg/index.html');
  const live = read('public/mtg/index.html');
  assert.match(preview, /CATALOG='\\/public\\/catalog\\.json'/);
  assert.match(live, /CATALOG='\\/catalog\\.json'/);
  assert.doesNotMatch(preview, /buy\\.stripe\\.com/);
  assert.doesNotMatch(live, /buy\\.stripe\\.com/);
  assert.equal(read('data/mtg-catalog.json'), read('public/data/mtg-catalog.json'));
  const canonical = json('public/catalog.json');
  for (const p of canonical.products.filter(p => /^EDH_/.test(String(p.id || '')))) {
    assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' must use deck_condition');
  }
});
