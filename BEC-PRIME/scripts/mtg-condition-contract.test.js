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

test('digital services cannot inherit card conditions; physical deck condition must be explicit', () => {
  const mtg = json('public/data/mtg-catalog.json');
  const diagnostic = json('BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
  assert.equal(diagnostic.status, 'held');
  assert.equal(diagnostic.checkout.mode, 'disabled');
  assert.equal(Object.hasOwn(diagnostic, 'condition'), false);
  for (const p of mtg.products) {
    if (p.category === 'digital-service') assert.equal(Object.hasOwn(p, 'condition'), false, p.id);
    if (p.category === 'commander-deck' && Object.hasOwn(p, 'condition'))
      assert.ok(typeof p.condition === 'string' && p.condition.trim().length > 0, p.id + ': condition cannot be inferred');
  }
});

test('MTG renderer has no default Lightly Played condition', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  assert.equal(source.includes('LP− (Lightly Played)'), false);
  assert.equal(patch.includes('Condition not specified'), false);
  assert.match(source, /p\.description\|\|p\.condition/);
  assert.match(patch, /conditionEligible/);
});

test('static root publication contains the manifest-driven MTG master paths', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  assert.equal(read('mtg/index.html'), read('public/mtg/index.html'));
  const canonical=json('data/mtg-catalog.json');
  const publicCatalog=json('public/data/mtg-catalog.json');
  assert.equal(publicCatalog.silo,'mtg');
  for(const product of publicCatalog.products){
    const match=canonical.products.find(x=>x.id===product.id);
    assert.ok(match,product.id+': missing canonical item');
    assert.equal(match.price,product.price,product.id+': price mismatch');
    assert.equal(Boolean(match.checkout_available),Boolean(product.checkout_available),product.id+': checkout mismatch');
  }
  for(const product of canonical.products.filter(x=>!publicCatalog.products.some(p=>p.id===x.id)))
    assert.notEqual(product.checkout_available,true,product.id+': private extra item cannot silently go live');
});
