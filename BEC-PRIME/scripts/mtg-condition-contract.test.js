'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));

test('Commander diagnostic remains held in the canonical product record', () => {
  const p = json('BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
  assert.equal(p.status, 'held');
  assert.equal(p.inventory, 0);
  assert.equal(p.checkout.mode, 'disabled');
  assert.equal(p.checkout.url, null);
  assert.equal(p.commercial_truth.sellable, false);
  assert.equal(p.commercial_truth.approval_required, true);
  assert.equal(p.fulfillment.mode, 'disabled');
  assert.equal(p.fulfillment.operator_required, true);
  assert.equal(Object.hasOwn(p, 'condition'), false);
  assert.equal(Object.hasOwn(p.commercial_truth, 'payment_link'), false);
});

test('canonical MTG catalog keeps the diagnostic explicitly non-saleable', () => {
  const canonical = json('data/mtg-catalog.json');
  const diagnostic = canonical.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.ok(diagnostic, 'canonical MTG catalog must retain the diagnostic SKU for reconciliation');
  assert.equal(diagnostic.status, 'held');
  assert.equal(diagnostic.inventory, 0);
  assert.equal(diagnostic.checkout_available, false);
  assert.equal(diagnostic.checkout_url ?? null, null);
  assert.equal(Object.hasOwn(diagnostic, 'condition'), false);

  // The public discovery catalog may intentionally omit held digital services.
  // If present, the item must remain held and must not expose checkout.
  const publicCatalog = json('public/data/mtg-catalog.json');
  const publicDiagnostic = publicCatalog.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  if (publicDiagnostic) {
    assert.equal(publicDiagnostic.status, 'held');
    assert.equal(publicDiagnostic.checkout_available, false);
    assert.equal(publicDiagnostic.checkout_url ?? null, null);
  }

  for (const catalog of [canonical, publicCatalog]) {
    for (const p of catalog.products.filter(p => p.category === 'commander-deck' || p.category === 'digital-service')) {
      assert.equal(Object.hasOwn(p, 'condition'), false, p.id + ' must not carry a card condition');
    }
  }
});

test('MTG condition rendering never invents a default card condition', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  assert.doesNotMatch(source, /condition\s*(?:\|\||\?\?)\s*['"`](?:LP|Lightly Played)/i);
  assert.doesNotMatch(patch, /condition\s*(?:\|\||\?\?)\s*['"`](?:LP|Lightly Played)/i);
  assert.match(patch, /const conditionEligible=\['single','single-card','mtg-single','physical-single'\]\.includes\(kind\)/);
  assert.match(patch, /conditionEligible&&typeof p\.condition==='string'&&p\.condition\.trim\(\)\?p\.condition\.trim\(\):''/);
  assert.match(source, /conditionEligible=\['single','single-card','mtg-single','physical-single'\]\.includes\(kind\)/);
  assert.match(source, /conditionEligible&&typeof p\.condition==='string'&&p\.condition\.trim\(\)/);
});

test('static MTG publication paths exist and neither exposes diagnostic checkout', () => {
  const required = [
    'mtg/index.html', 'public/mtg/index.html',
    'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'public/assets/mtg-deck-grid.js',
    'data/decklists/quintorius.json'
  ];
  for (const p of required) {
    assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the expected publication/source path');
  }

  for (const p of ['mtg/index.html', 'public/mtg/index.html', 'BEC-PRIME/website/mtg-catalog.html']) {
    const html = read(p);
    assert.doesNotMatch(html, /https:\/\/buy\.stripe\.com\//i, p + ' must not expose a direct Stripe Payment Link');
    assert.doesNotMatch(html, /href=["'][^"']*\/buy\/COMMANDER-DECK-DIAGNOSTIC-001/i, p + ' must not link to held diagnostic checkout');
  }
});
