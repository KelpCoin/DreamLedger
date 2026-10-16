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

test('digital services do not inherit card condition; physical decks may state deck condition', () => {
  const diagnostic = json('BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
  assert.equal(diagnostic.status, 'held');
  assert.equal(diagnostic.checkout.mode, 'disabled');
  assert.equal(diagnostic.checkout_available, undefined);
  assert.equal(Object.hasOwn(diagnostic, 'condition'), false);
  const mtg = json('data/mtg-catalog.json');
  for (const p of mtg.products.filter(p => p.category === 'digital-service')) {
    assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' must not carry a physical-card condition');
  }
  for (const p of mtg.products.filter(p => p.category === 'commander-deck')) {
    assert.notEqual(p.condition, 'Lightly Played', p.id + ' must not inherit a single-card condition default');
  }
});

test('MTG renderer has no default Lightly Played condition', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  assert.equal(source.includes('LP− (Lightly Played)'), false);
  assert.equal(patch.includes('Condition not specified'), false);
  assert.doesNotMatch(source, /LP− \(Lightly Played\)|defaultCondition\s*=\s*['\"]Lightly Played['\"]/i);
  assert.match(patch, /conditionEligible/);
});

test('static root publication contains the manifest-driven MTG master paths', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  const master = read('mtg/index.html');
  const published = read('public/mtg/index.html');
  assert.match(master, /\/data\/mtg-catalog\.json/);
  assert.match(published, /\/data\/mtg-catalog\.json/);
  const manifest = json('silos/mtg/silo.json');
  assert.equal(typeof manifest.catalog, 'string');
  assert.ok(manifest.catalog.length > 0);
});
