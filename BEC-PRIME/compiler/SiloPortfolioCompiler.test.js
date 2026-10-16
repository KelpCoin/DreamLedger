'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const canonicalCheckoutGate = require('../runtime/canonicalCheckoutGate');

const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');
const COMPILER = path.join(ROOT, 'compiler', 'SiloPortfolioCompiler.js');
const CATALOG = path.join(ROOT, 'catalog', 'compiled', 'silo-portfolio.json');
const PROOF = path.join(ROOT, 'PROOF-SILO-PORTFOLIO-COMPILATION.json');
const PORTFOLIO_DIR = path.join(ROOT, 'compiled', 'website', 'portfolio');
const PUBLIC_INDEX = path.join(REPO_ROOT, 'public', 'portfolio', 'index.html');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('portfolio compiler treats zero checkoutable offers as a valid held state', () => {
  let previousProof = null;
  try { previousProof = readJson(PROOF); } catch {}
  execFileSync(process.execPath, [COMPILER], { cwd: ROOT, stdio: 'pipe' });

  const catalog = readJson(CATALOG);
  const proof = readJson(PROOF);
  const publicIndex = fs.readFileSync(PUBLIC_INDEX, 'utf8');
  const compiledIndex = fs.readFileSync(path.join(PORTFOLIO_DIR, 'index.html'), 'utf8');
  const checkoutable = canonicalCheckoutGate.loadCanonicalCheckoutableProducts({ repoRoot: REPO_ROOT });
  const byId = new Map(checkoutable.map(product => [product.id, product]));

  assert.equal(catalog.status, 'COMPILED');
  assert.equal(proof.status, 'PASS');
  assert.equal(catalog.offer_count, catalog.offers.length);
  assert.equal(proof.offer_count, catalog.offer_count);
  assert.equal(proof.commerce_status, catalog.commerce_status);
  assert.equal(proof.activation_allowed, catalog.offer_count > 0);

  for (const offer of catalog.offers) {
    const product = byId.get(offer.product_id);
    assert.ok(product, 'compiled offer must still pass the canonical product gate: ' + offer.offer_id);
    assert.equal(offer.checkout_url, canonicalCheckoutGate.checkoutUrl(product));
    assert.equal(offer.activation_state, 'ACTIVE_CHECKOUT');
    assert.equal(offer.checkout, 'STRIPE_LIVEMODE');
  }

  if (catalog.offer_count === 0) {
    assert.equal(catalog.commerce_status, 'HOLD_NO_APPROVED_CHECKOUTS');
    assert.equal(proof.activation_allowed, false);
    assert.match(publicIndex, /No offers currently cleared for checkout/);
    assert.match(compiledIndex, /No offers currently cleared for checkout/);
    assert.match(publicIndex, /name="robots" content="noindex,follow"/);
    assert.doesNotMatch(publicIndex, /https:\/\/(?:buy|checkout)\.stripe\.com\//i);
    assert.doesNotMatch(compiledIndex, /https:\/\/(?:buy|checkout)\.stripe\.com\//i);

    const activeNames = new Set(catalog.offers.map(offer => path.basename(offer.canonical_url)));
    for (const oldOffer of (Array.isArray(previousProof?.offers) ? previousProof.offers : [])) {
      const oldName = path.basename(String(oldOffer.canonical_url || ''));
      if (!oldName || activeNames.has(oldName)) continue;
      assert.equal(fs.existsSync(path.join(PORTFOLIO_DIR, oldName)), false, 'stale checkout page must be removed: ' + oldName);
    }
  }
});
