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

test('published MTG catalogue matches the master; digital services have no card condition', () => {
  const master = json('data/mtg-catalog.json');
  const published = json('public/data/mtg-catalog.json');
  assert.deepEqual(published, master, 'public MTG catalogue must match master catalogue');

  const diagnostic = master.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.ok(diagnostic, 'held Commander diagnostic record must remain explicit');
  assert.equal(diagnostic.status, 'held');
  assert.equal(diagnostic.checkout_available, false);
  assert.equal(Object.hasOwn(diagnostic, 'condition'), false);

  for (const p of master.products.filter(p => p.category === 'commander-deck' || p.category === 'digital-service')) {
    assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' must not carry a single-card condition');
  }
});

test('MTG renderer does not invent card condition; seller form asks for one', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  const listing = read('public/mtg-list.html');

  assert.equal(source.includes('Lightly Played'), false, 'catalog renderer must not assume a single-card condition');
  assert.equal(patch.includes('Condition not specified'), false, 'commerce patch must not invent a condition');
  assert.equal(source.includes("|| 'LP'"), false, 'catalog renderer must not default condition to LP');
  assert.equal(source.includes("?? 'LP'"), false, 'catalog renderer must not default condition to LP');
  assert.equal(listing.includes('id="condition"'), true, 'single-card listing form must ask for condition');
  assert.equal(listing.includes('<option>Near Mint</option><option>Lightly Played</option>'), true,
    'single-card condition choices must be explicit seller inputs');
});

test('static root publication contains and matches the manifest-driven MTG master surfaces', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  assert.equal(read('mtg/index.html'), read('public/mtg/index.html'));
  assert.deepEqual(json('data/mtg-catalog.json'), json('public/data/mtg-catalog.json'));
});
