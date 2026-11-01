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

test('live Stripe inactive diagnostic stays held in approved and featured source without changing IDs', () => {
  const approved = json('BEC-PRIME/catalog/offers/approved.json').approved;
  const a = approved.find(x => x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
  const featured = json('BEC-PRIME/catalog/featured-offer.json');
  const product = json('BEC-PRIME/catalog/products/' + id + '.json');
  assert.ok(a);
  assert.equal(a.payment_link_id, 'plink_1UKS00EGgEAnUFF9kUjraaL5');
  assert.equal(a.payment_link_status, 'INACTIVE_LIVEMODE');
  assert.equal(a.release_status, 'HOLD');
  assert.equal(featured.payment_link_status, 'INACTIVE_LIVEMODE');
  assert.equal(featured.public_visibility, 'held');
  assert.equal(featured.stripe_product_id, 'prod_V6iVKl9HgFpzRU');
  assert.equal(featured.stripe_price_id, 'price_1UFFY1EGgEAnUFF9Yq03zIa7');
  assert.equal(featured.price, 29);
  assert.equal(product.price, 29);
  assert.equal(product.status, 'held');
  assert.equal(product.checkout.mode, 'disabled');
});

test('historically approved MTG offer cannot auto-promote to checkout-ready', () => {
  const { compileApprovedOffers } = require('../compiler/OfferCompiler');
  const records = json('BEC-PRIME/catalog/offers/approved.json').approved;
  const capabilities = records.map(r => ({id: r.capability_id, silo: r.silo}));
  const compiled = compileApprovedOffers(records, capabilities, []);
  assert.equal(compiled.errors.length, 0);
  const a = compiled.approved.find(x => x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
  assert.ok(a);
  assert.equal(a.status, 'HELD_UNVERIFIED');
  assert.equal(a.approval_required, true);
  assert.equal(a.checkout_available, false);
  assert.ok(a.readiness_blockers.includes('LINK_NOT_VERIFIED_ACTIVE'));
  assert.ok(a.readiness_blockers.includes('PRODUCT_NOT_PUBLISHED'));
  assert.ok(a.readiness_blockers.includes('TRUSTED_PROVIDER_RECEIPT_REQUIRED'));
  for (const offer of compiled.approved) {
    assert.equal(offer.checkout_available, false, offer.offer_id);
    assert.ok(offer.readiness_blockers.includes('TRUSTED_PROVIDER_RECEIPT_REQUIRED'));
  }
});

test('fabricated local approval, active link, and ready fulfillment cannot replace provider receipt', () => {
  const { assessApprovedReadiness } = require('../compiler/OfferCompiler');
  const record = {
    product_id: id, silo: 'mtg', price: 29, currency: 'NZD',
    payment_link_status: 'ACTIVE_LIVEMODE',
    payment_link_url: 'https://buy.stripe.com/example',
    payment_link_id: 'plink_test'
  };
  const product = {
    id, silo: 'mtg', status: 'published', price: 29, currency: 'nzd',
    checkout: {mode: 'payment_link'},
    commercial_truth: {
      sellable: true, approval_required: false,
      payment_link: record.payment_link_url,
      stripe_payment_link_id: record.payment_link_id
    }
  };
  const blockers = assessApprovedReadiness(record, product, {ready: true, operator_required: false});
  assert.deepEqual(blockers, ['TRUSTED_PROVIDER_RECEIPT_REQUIRED']);
  assert.ok(assessApprovedReadiness(record, null, null).includes('CANONICAL_PRODUCT_MISSING_OR_MISMATCHED'));
  assert.ok(assessApprovedReadiness({...record, release_status: 'HOLD'}, product, {ready:true,operator_required:false}).includes('OWNER_RELEASE_HOLD'));
});

test('Gauntlet accepts correctly held historical approval but never calls it a sale', () => {
  const os = require('node:os');
  const {run} = require('../gauntlet/GauntletV6');
  const {compileApprovedOffers} = require('../compiler/OfferCompiler');
  const approved = json('BEC-PRIME/catalog/offers/approved.json');
  const caps = json('BEC-PRIME/catalog/ip-capabilities.json');
  const compiled = compileApprovedOffers(approved.approved, caps.capabilities, []);
  assert.equal(compiled.errors.length, 0);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-held-offer-'));
  try {
    const offerFile = path.join(tmp, 'offers.json');
    fs.writeFileSync(offerFile, JSON.stringify({offers: compiled.approved}));
    const g = run({
      offerFile,
      approvedFile: path.join(root, 'BEC-PRIME/catalog/offers/approved.json'),
      ipFile: path.join(root, 'BEC-PRIME/catalog/ip-capabilities.json'),
      writeProof: false
    });
    assert.equal(g.status, 'PASS', JSON.stringify(g.checks.filter(x => x.status === 'FAIL')));
    assert.equal(g.checks.some(x => x.id.includes('.held') && x.status === 'PASS'), true);
    assert.equal(compiled.approved.some(x => x.checkout_available), false);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});

const vm = require('node:vm');

// Exercise the actual CLI verifier with isolated in-memory catalogue fixtures.
// No real product, payment link, checkout, provider or compiled artefact is changed.
function inspectProductionContract(mutator = () => {}) {
  const fixture = {
    product: json('BEC-PRIME/catalog/products/' + id + '.json'),
    approved: json('BEC-PRIME/catalog/offers/approved.json'),
    featured: json('BEC-PRIME/catalog/featured-offer.json')
  };
  mutator(fixture);
  const fakeRoot = path.join(root, 'BEC-PRIME');
  let proof, exitCode;
  const fakeFs = {
    existsSync: () => true,
    statSync: () => ({size: 1}),
    readFileSync: p => {
      const rel = path.relative(fakeRoot, p).replace(/\\/g, '/');
      if (rel === 'catalog/products/' + id + '.json') return JSON.stringify(fixture.product);
      if (rel === 'catalog/offers/approved.json') return JSON.stringify(fixture.approved);
      if (rel === 'catalog/featured-offer.json') return JSON.stringify(fixture.featured);
      return '<!doctype html><html><body>Free tools</body></html>';
    },
    writeFileSync: (_p, data) => { proof = JSON.parse(data); }
  };
  const script = read('BEC-PRIME/scripts/verify-production-contract.js');
  vm.runInNewContext(script, {
    require: name => name === 'fs' ? fakeFs : require(name),
    __dirname: path.join(fakeRoot, 'scripts'),
    console: {log() {}},
    process: {exit: code => { exitCode = code; }}
  }, {timeout: 2000});
  assert.ok(proof, 'verifier must write a machine-readable proof');
  return {proof, exitCode};
}

test('production contract correctly classifies an intentional hold without imaginary link drift', () => {
  const {proof, exitCode} = inspectProductionContract();
  assert.equal(exitCode, 1, 'held product MUST block release');
  assert.equal(proof.status, 'FAIL');
  assert.equal(proof.release_gate, 'HOLD');
  assert.equal(proof.release_reason, 'EXPECTED_HELD_UNSELLABLE');
  assert.equal(proof.catalogue_integrity, 'PASS');
  assert.equal(proof.errors.includes('STRIPE_LINK_DRIFT'), false);
  assert.ok(proof.errors.includes('STRIPE_LINK_NOT_LIVEMODE'));
  assert.ok(proof.errors.includes('PRODUCT_NOT_SELLABLE'));
});

test('production contract rejects mismatched approved versus featured payment URL', () => {
  const {proof, exitCode} = inspectProductionContract(f => {
    f.featured.payment_link_url = 'https://buy.stripe.com/wrong-reference';
  });
  assert.equal(exitCode, 1);
  assert.equal(proof.catalogue_integrity, 'FAIL');
  assert.ok(proof.errors.includes('STRIPE_LINK_DRIFT'));
});

test('production contract rejects payment link ID and state divergence', () => {
  const {proof} = inspectProductionContract(f => {
    f.featured.payment_link_id = 'plink_wrong';
    f.featured.payment_link_status = 'ACTIVE_LIVEMODE';
  });
  assert.equal(proof.catalogue_integrity, 'FAIL');
  assert.ok(proof.errors.includes('STRIPE_LINK_ID_DRIFT'));
  assert.ok(proof.errors.includes('STRIPE_LINK_STATUS_DRIFT'));
  assert.ok(proof.errors.includes('HELD_SOURCE_INCONSISTENT'));
});

test('production contract catches price and SKU tampering even while held', () => {
  const {proof, exitCode} = inspectProductionContract(f => {
    f.featured.price = 30;
    f.featured.sku = 'UNRELATED-SKU';
  });
  assert.equal(exitCode, 1);
  assert.equal(proof.catalogue_integrity, 'FAIL');
  assert.ok(proof.errors.includes('PRICE_DRIFT'));
  assert.ok(proof.errors.includes('SKU_DRIFT'));
});

test('source-only fake active checkout cannot attest settlement or delivery', () => {
  const {proof, exitCode} = inspectProductionContract(f => {
    const a = f.approved.approved.find(x => x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
    f.product.status = 'published';
    f.product.checkout.mode = 'payment_link';
    f.product.commercial_truth.approval_required = false;
    f.product.commercial_truth.sellable = true;
    f.product.commercial_truth.payment_link = a.payment_link_url;
    a.payment_link_status = 'ACTIVE_LIVEMODE';
    a.release_status = 'READY';
    f.featured.payment_link_status = 'ACTIVE_LIVEMODE';
    f.featured.release_status = 'READY';
    f.featured.public_visibility = 'public';
  });
  assert.equal(exitCode, 1);
  assert.equal(proof.status, 'FAIL');
  assert.equal(proof.release_gate, 'HOLD');
  assert.equal(proof.catalogue_integrity, 'PASS');
  assert.ok(proof.errors.includes('LIVE_PROVIDER_SETTLEMENT_AND_DELIVERY_UNVERIFIED'));
});

test('a nonheld product cannot silently omit its own approved payment link', () => {
  const {proof, exitCode} = inspectProductionContract(f => {
    f.product.status = 'published';
    f.product.checkout.mode = 'payment_link';
    f.product.commercial_truth.approval_required = false;
    f.product.commercial_truth.sellable = true;
  });
  assert.equal(exitCode, 1);
  assert.ok(proof.errors.includes('STRIPE_LINK_DRIFT'));
  assert.equal(proof.catalogue_integrity, 'FAIL');
});
