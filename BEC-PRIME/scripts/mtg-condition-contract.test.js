'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const id = 'COMMANDER-DECK-DIAGNOSTIC-001';

test('Commander diagnostic is held in master and public commercial catalogues', () => {
  const p = json('BEC-PRIME/catalog/products/' + id + '.json');
  const commercial = json('public/catalog.json').products.find(x => x.id === id);
  assert.ok(commercial, 'held digital SKU must remain visible in commercial truth');
  assert.equal(p.status, 'held');
  assert.equal(p.inventory, 0);
  assert.equal(p.checkout.mode, 'disabled');
  assert.equal(p.commercial_truth.sellable, false);
  assert.equal(p.commercial_truth.approval_required, true);
  assert.equal(Object.hasOwn(p, 'condition'), false);
  assert.equal(Object.hasOwn(p.commercial_truth, 'payment_link'), false);
  assert.equal(commercial.status, 'held');
  assert.equal(commercial.checkout_available, false);
  assert.equal(commercial.inventory, 0);
  assert.equal(commercial.price, 29);
  assert.equal(commercial.delivery_test_status, 'UNVERIFIED');
  assert.equal(Object.hasOwn(commercial, 'condition'), false);
});

test('deck-only catalogue cannot inherit a default single-card grade or digital checkout', () => {
  const mtg = json('public/data/mtg-catalog.json');
  const commercial = json('public/catalog.json');
  assert.equal(mtg.silo, 'mtg');
  assert.equal(mtg.currency, 'NZD');
  assert.ok(mtg.products.length >= 3);
  assert.equal(mtg.products.some(p => p.id === id && p.checkout_available), false);
  for (const p of mtg.products) {
    assert.equal(p.checkout_available, false, p.id + ' cannot imply verified checkout');
    if (p.category === 'digital-service') {
      assert.equal(Object.hasOwn(p, 'condition'), false);
      assert.equal(p.status, 'held');
      continue;
    }
    if (p.category === 'commander-deck') {
      // Decks can have seller-reported physical condition, never an inherited
      // card-grade default. The commercial catalogue must already document it.
      assert.doesNotMatch(String(p.condition || ''), /^(?:LP|NM|MP|HP|DMG|Lightly Played|Near Mint)$/i);
      if (p.condition) {
        const source = commercial.products.find(x => x.id === p.id);
        assert.ok(source && typeof source.condition === 'string' && source.condition.trim(),
          p.id + ' condition requires an existing seller description');
      }
    }
  }
});

test('legacy patch grades only physical singles; modern renderer does not default to LP', () => {
  const source = read('BEC-PRIME/website/mtg-catalog.html');
  const patch = read('BEC-PRIME/scripts/Patch-MTG-CommerceSurface.js');
  assert.doesNotMatch(source, /LP\u2212 \(Lightly Played\)|Condition not specified/);
  assert.doesNotMatch(patch, /LP\u2212 \(Lightly Played\)|Condition not specified/);
  assert.doesNotMatch(source, /conditionEligible/);
  assert.match(patch, /const conditionEligible=\['single','single-card','mtg-single','physical-single'\]/);
  assert.match(patch, /const condition=conditionEligible&&typeof p\.condition==='string'/);
});

test('static root publication mirrors reviewed public MTG deck data and hub', () => {
  for (const p of [
    'mtg/index.html', 'silos/mtg/silo.json', 'data/mtg-catalog.json',
    'data/_catalog-empty.template.json', 'assets/mtg-deck-grid.js',
    'assets/silo-master.css', 'data/decklists/quintorius.json'
  ]) assert.equal(fs.existsSync(path.join(root, p)), true, p + ' must exist at the static publish root');
  assert.equal(read('mtg/index.html'), read('public/mtg/index.html'));
  assert.equal(read('data/mtg-catalog.json'), read('public/data/mtg-catalog.json'));
});

test('disputed EDH_0001 has consistent indicative price, zero saleable stock, and no checkout', () => {
  const rootCatalog = json('data/mtg-catalog.json');
  const published = json('public/data/mtg-catalog.json');
  const commercial = json('public/catalog.json');
  const r = rootCatalog.products.find(p => p.id === 'EDH_0001');
  const p = published.products.find(p => p.id === 'EDH_0001');
  const c = commercial.products.find(p => p.id === 'EDH_0001');
  assert.ok(r && p && c, 'EDH_0001 must exist in all three catalogues');
  assert.equal(r.price, p.price);
  assert.equal(p.price, c.price);
  assert.equal(p.currency.toLowerCase(), c.currency.toLowerCase());
  assert.equal(p.inventory, 0, 'no verified stock must be advertised as saleable');
  assert.equal(p.availability, 'review_required');
  assert.equal(c.availability, 'review_required');
  assert.equal(p.checkout_available, false);
  assert.equal(c.checkout_available, false);
  assert.equal(p.checkout_url, null);
  assert.equal(c.checkout_url, null);
  assert.equal(p.sale_mode, 'request_confirmation');
});

test('static root free-first regression', () => {
  const a = read('mtg/index.html'), b = read('public/mtg/index.html');
  assert.equal(a, b);
  assert.equal((a.match(/class="hub-free-card"/g) || []).length, 5);
  assert.equal((a.match(/data-auction-slot=/g) || []).length, 3);
  assert.ok(a.indexOf('id="welcome"') >= 0 && a.indexOf('id="welcome"') < a.indexOf('id="auctions"'));
  assert.equal(a.includes('https://buy.stripe.com/'), false);
});
