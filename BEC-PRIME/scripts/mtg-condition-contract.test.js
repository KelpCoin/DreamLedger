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

test('published catalogue matches the master and digital services do not inherit card condition', () => {
  const master = json('data/mtg-catalog.json');
  const published = json('public/data/mtg-catalog.json');
  assert.deepEqual(published, master, 'public MTG catalogue must match master catalogue');

  const diagnostic = master.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.ok(diagnostic, 'held Commander diagnostic record must remain explicit in the catalogue');
  assert.equal(diagnostic.status, 'held');
  assert.equal(diagnostic.checkout_available, false);
  assert.equal(Object.hasOwn(diagnostic, 'condition'), false);

  for (const p of master.products.filter(p => p.category === 'commander-deck' || p.category === 'digital-service')) {
    assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' must not carry a single-card condition');
  }
});

test('MTG renderer never invents a default card condition', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  const listing = read('public/mtg-list.html');

  assert.equal(source.includes('Lightly Played'), false, 'deck/catalog renderer must not assume single-card condition');
  assert.equal(patch.includes('Condition not specified'), false, 'commerce patch must not invent a condition label');
  assert.doesNotMatch(source, /condition\\s*(?:\\|\\||\\?\\?)\\s*['"](?:LP|Lightly Played)['"]/i);
  assert.doesNotMatch(source, /condition\\s*\\?\\s*['"]LP['"]/i);

  assert.match(listing, /id="condition"/, 'single-card listing form must ask the seller for condition');
  assert.match(listing, /<option>Near Mint<\\/option><option>Lightly Played<\\/option>/,
    'single-card condition choices are explicit seller inputs, not catalogue defaults');
});

test('static root publication contains the manifest-driven MTG master paths', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  assert.equal(read('mtg/index.html'), read('public/mtg/index.html'));
  assert.deepEqual(json('data/mtg-catalog.json'), json('public/data/mtg-catalog.json'));
});
