'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { evaluateCanonicalProduct, evaluateCanonicalDynamicCheckoutProduct } = require('./canonicalCheckoutGate');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-checkout-gate-'));
  const proofRef = 'proof/commerce/products/TEST-001.json';
  const proofPath = path.join(root, proofRef);
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify({
    schema: 'dreamledger/product-checkout-proof/v1',
    product_id: 'TEST-001',
    verdict: 'PASS',
    test_mode_chain: {
      checkout: 'PASS',
      settlement: 'PASS',
      attribution: 'PASS',
      fulfillment: 'PASS',
      delivery: 'PASS'
    }
  }));
  const product = {
    id: 'TEST-001',
    status: 'published',
    silo: 'mtg',
    name: 'Test product',
    price: 29,
    price_unit: 'major',
    currency: 'nzd',
    inventory: 1,
    checkout_available: true,
    checkout: { mode: 'payment_link', url: 'https://buy.stripe.com/test_link' },
    commercial_truth: { approval_required: false, sellable: true, payment_link: 'https://buy.stripe.com/test_link' },
    gauntlet: { status: 'PASS', test_mode_chain: 'PASS', evidence_ref: proofRef }
  };
  const registry = { entries: { 'TEST-001': { ready: true, operator_required: false } } };
  return { root, product, registry };
}

test('allows a canonical product only with all gates and linked test-mode proof', () => {
  const f = fixture();
  try {
    assert.equal(evaluateCanonicalProduct(f.product, f.registry, f.root).allowed, true);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('holds a product when test-mode settlement and delivery proof is absent', () => {
  const f = fixture();
  try {
    delete f.product.gauntlet;
    const result = evaluateCanonicalProduct(f.product, f.registry, f.root);
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes('product_gauntlet_not_pass'));
    assert.ok(result.reasons.includes('product_checkout_proof_missing_or_invalid'));
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('rejects a held product even when a Stripe URL exists', () => {
  const f = fixture();
  try {
    f.product.commercial_truth.approval_required = true;
    f.product.commercial_truth.sellable = false;
    f.product.checkout_available = false;
    const result = evaluateCanonicalProduct(f.product, f.registry, f.root);
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes('operator_approval_gate_closed'));
    assert.ok(result.reasons.includes('checkout_not_explicitly_enabled'));
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('rejects legacy silo products even with a passing proof', () => {
  const f = fixture();
  try {
    f.product.silo = 'dreamiez';
    const result = evaluateCanonicalProduct(f.product, f.registry, f.root);
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes('silo_not_canonical_publishable'));
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('rejects proof paths that escape the repository root', () => {
  const f = fixture();
  try {
    f.product.gauntlet.evidence_ref = '../../outside.json';
    const result = evaluateCanonicalProduct(f.product, f.registry, f.root);
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes('product_checkout_proof_missing_or_invalid'));
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('allows dynamic checkout only with canonical publication, fulfillment, and linked proof', () => {
  const f = fixture();
  try {
    f.product.checkout.mode = 'payment';
    delete f.product.checkout.url;
    delete f.product.commercial_truth.payment_link;
    const result = evaluateCanonicalDynamicCheckoutProduct(f.product, f.registry, f.root);
    assert.equal(result.allowed, true);
    assert.equal(result.checkout_url, null);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('blocks a published dynamic-checkout product when fulfillment is held or proof is absent', () => {
  const f = fixture();
  try {
    f.product.checkout.mode = 'payment';
    f.product.checkout_available = true;
    f.registry.entries['TEST-001'].ready = false;
    delete f.product.gauntlet;
    const result = evaluateCanonicalDynamicCheckoutProduct(f.product, f.registry, f.root);
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes('fulfillment_contract_not_ready'));
    assert.ok(result.reasons.includes('product_checkout_proof_missing_or_invalid'));
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});
