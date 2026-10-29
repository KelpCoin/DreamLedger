'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mtg = JSON.parse(fs.readFileSync(path.join(root,'public/data/mtg-catalog.json'),'utf8'));
const globalCatalog = JSON.parse(fs.readFileSync(path.join(root,'public/catalog.json'),'utf8'));
const page = fs.readFileSync(path.join(root,'public/mtg/index.html'),'utf8');
assert.equal(mtg.silo,'mtg');
assert.ok(Array.isArray(mtg.products));
assert.ok(Array.isArray(globalCatalog.products));
assert.ok(page.includes("Promise.all([fetchJSON('/data/mtg-catalog.json'), fetchJSON('/catalog.json')])"));
assert.ok(page.includes('Checkout held until authoritative inventory and pricing agree.'));
assert.ok(!page.includes('var FALLBACK ='));
assert.equal(fs.readFileSync(path.join(root,'mtg/index.html'),'utf8'),page,'Legacy and public MTG storefront must stay identical');
const globalById = new Map(globalCatalog.products.map(p => [p.id,p]));
const conflicts = [];
for (const p of mtg.products.filter(x => x.silo === 'mtg' && x.category === 'commander-deck' && x.status === 'published')) {
  const other = globalById.get(p.id);
  if (!other || Number(other.price) !== Number(p.price) ||
      other.checkout_available !== p.checkout_available ||
      other.status !== p.status ||
      (p.checkout_available && p.checkout_url !== other.checkout_url)) {
    conflicts.push({id:p.id,mtg_price:p.price,global_price:other?.price??null,
      mtg_checkout:!!p.checkout_available,global_checkout:!!other?.checkout_available});
  }
}
console.log(JSON.stringify({schema:'beck/mtg-master-proof/v1',master_silo:'mtg',
  safety_check:'STATIC_ASSERTIONS_PASS',reconciled_catalogues:conflicts.length===0,conflicts,
  clone_gate:conflicts.length?'HOLD':'HOLD_PENDING_EXTERNAL_COMMERCE_PROOF'},null,2));
// Contradictions are expected until independently resolved. Gate remains held.
if (conflicts.length) console.error('CATALOGUE_CONFLICT: checkout must remain blocked for conflicting SKUs.');
