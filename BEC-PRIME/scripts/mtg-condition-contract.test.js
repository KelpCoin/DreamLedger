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
  assert.equal(diagnostic, undefined, 'held diagnostic must not be exposed in the public catalogue');
  for (const p of mtg.products.filter(p => p.category === 'digital-service')) {
    assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' must not carry a trading-card condition');
  }
  for (const p of mtg.products.filter(p => p.category === 'commander-deck')) {
    assert.equal(p.silo, 'mtg', p.id + ' must remain in the MTG silo');
    assert.equal(p.checkout_available, false, p.id + ' must not claim a live checkout when sale mode is claim-by-message');
  }
});

test('MTG renderer has no default Lightly Played condition', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  assert.equal(source.includes('LP− (Lightly Played)'), false);
  assert.equal(patch.includes('Condition not specified'), false);
  assert.match(source, /const cond=p\.condition\?/);
  assert.equal(source.includes('condition: \'Lightly Played\''), false);
  assert.match(patch, /conditionEligible=\['single','single-card','mtg-single','physical-single'\]/);
});

test('static root publication contains the manifest-driven MTG master paths', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  const rootCatalog = json('data/mtg-catalog.json');
  const publicCatalog = json('public/data/mtg-catalog.json');
  assert.equal(rootCatalog.silo, 'mtg');
  assert.equal(publicCatalog.silo, 'mtg');
  assert.ok(Array.isArray(rootCatalog.products));
  assert.ok(Array.isArray(publicCatalog.products));
  const rootDiagnostic = rootCatalog.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.equal(rootDiagnostic?.status, 'held', 'root catalog may retain the held diagnostic record but must not expose it as sellable');
  assert.equal(rootDiagnostic?.checkout_available, false);
  assert.equal(publicCatalog.products.some(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001'), false, 'public catalog must omit the held diagnostic');
});
