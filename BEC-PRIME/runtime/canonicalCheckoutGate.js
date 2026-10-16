'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PUBLISHABLE_SILOS = new Set(['mtg', 'crypto', 'media_music', 'digital_products']);

function isStripeUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && ['buy.stripe.com', 'checkout.stripe.com'].includes(u.hostname);
  } catch {
    return false;
  }
}

function priceInMajorUnits(product) {
  const value = Number(product?.price);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = String(product?.price_unit || '').toLowerCase();
  if (unit === 'major') return value;
  if (unit === 'minor' || unit === 'cents') return value / 100;
  return null;
}

function positiveInventory(product) {
  return [product.inventory, product.inventory_units, product.inventory_pixels]
    .some(value => Number.isFinite(Number(value)) && Number(value) > 0);
}

function checkoutUrl(product) {
  return product?.commercial_truth?.payment_link
    || product?.checkout?.url
    || product?.checkout_url
    || null;
}

function proofPasses(product, repoRoot) {
  const ref = product?.gauntlet?.evidence_ref;
  if (typeof ref !== 'string' || !ref.trim() || path.isAbsolute(ref)) return false;
  const root = path.resolve(repoRoot);
  const file = path.resolve(root, ref);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return false;
  try {
    const proof = JSON.parse(fs.readFileSync(file, 'utf8'));
    const chain = proof.test_mode_chain;
    return proof.schema === 'dreamledger/product-checkout-proof/v1'
      && proof.product_id === product.id
      && proof.verdict === 'PASS'
      && chain && chain.checkout === 'PASS'
      && chain.settlement === 'PASS'
      && chain.attribution === 'PASS'
      && chain.fulfillment === 'PASS'
      && chain.delivery === 'PASS';
  } catch {
    return false;
  }
}

function evaluateCanonicalProduct(product, registry, repoRoot) {
  const reasons = [];
  if (!product || typeof product !== 'object') return { allowed: false, reasons: ['product_not_object'] };
  if (product.status !== 'published') reasons.push('product_not_published');
  if (!PUBLISHABLE_SILOS.has(product.silo)) reasons.push('silo_not_canonical_publishable');
  if (product.commercial_truth?.approval_required !== false) reasons.push('operator_approval_gate_closed');
  if (product.commercial_truth?.sellable !== true) reasons.push('commercial_sellable_not_true');
  if (product.checkout_available !== true) reasons.push('checkout_not_explicitly_enabled');
  if (!['stripe', 'payment_link'].includes(product.checkout?.mode)) reasons.push('checkout_mode_not_canonical');
  if (!isStripeUrl(checkoutUrl(product))) reasons.push('stripe_payment_link_missing_or_invalid');
  if (!positiveInventory(product)) reasons.push('inventory_not_positive');
  if (priceInMajorUnits(product) === null) reasons.push('price_unit_missing_or_invalid');

  const entry = registry?.entries?.[product.id]
    || (product.offer_id && registry?.entries?.[product.offer_id])
    || null;
  if (!entry || entry.ready !== true || entry.operator_required !== false) reasons.push('fulfillment_contract_not_ready');
  if (entry?.canonical_product_id && entry.canonical_product_id !== product.id) reasons.push('fulfillment_product_mismatch');

  if (product.gauntlet?.status !== 'PASS') reasons.push('product_gauntlet_not_pass');
  if (product.gauntlet?.test_mode_chain !== 'PASS') reasons.push('test_mode_chain_not_pass');
  if (!proofPasses(product, repoRoot)) reasons.push('product_checkout_proof_missing_or_invalid');

  return { allowed: reasons.length === 0, reasons, checkout_url: checkoutUrl(product) };
}

function evaluateCanonicalDynamicCheckoutProduct(product, registry, repoRoot) {
  const reasons = [];
  if (!product || typeof product !== 'object') return { allowed: false, reasons: ['product_not_object'] };
  if (product.status !== 'published') reasons.push('product_not_published');
  if (!PUBLISHABLE_SILOS.has(product.silo)) reasons.push('silo_not_canonical_publishable');
  if (product.commercial_truth?.approval_required !== false) reasons.push('operator_approval_gate_closed');
  if (product.commercial_truth?.sellable !== true) reasons.push('commercial_sellable_not_true');
  if (product.checkout_available !== true) reasons.push('checkout_not_explicitly_enabled');
  if (!['payment', 'stripe', 'checkout_session'].includes(product.checkout?.mode)) reasons.push('dynamic_checkout_mode_not_canonical');
  if (!positiveInventory(product)) reasons.push('inventory_not_positive');
  if (priceInMajorUnits(product) === null) reasons.push('price_unit_missing_or_invalid');

  const entry = registry?.entries?.[product.id]
    || (product.offer_id && registry?.entries?.[product.offer_id])
    || null;
  if (!entry || entry.ready !== true || entry.operator_required !== false) reasons.push('fulfillment_contract_not_ready');
  if (entry?.canonical_product_id && entry.canonical_product_id !== product.id) reasons.push('fulfillment_product_mismatch');
  if (product.gauntlet?.status !== 'PASS') reasons.push('product_gauntlet_not_pass');
  if (product.gauntlet?.test_mode_chain !== 'PASS') reasons.push('test_mode_chain_not_pass');
  if (!proofPasses(product, repoRoot)) reasons.push('product_checkout_proof_missing_or_invalid');

  return { allowed: reasons.length === 0, reasons, checkout_url: null, checkout_mode: product.checkout?.mode || null };
}

function loadCanonicalCheckoutableProducts(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..'));
  const productsDir = path.join(repoRoot, 'BEC-PRIME', 'catalog', 'products');
  const registryPath = path.join(repoRoot, 'BEC-PRIME', 'fulfillment', 'PRODUCT-FULFILLMENT-REGISTRY.json');
  if (!fs.existsSync(productsDir) || !fs.existsSync(registryPath)) return [];
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch {
    return [];
  }
  const products = [];
  for (const name of fs.readdirSync(productsDir).filter(name => name.endsWith('.json')).sort()) {
    try {
      const product = JSON.parse(fs.readFileSync(path.join(productsDir, name), 'utf8'));
      if (evaluateCanonicalProduct(product, registry, repoRoot).allowed) products.push(product);
    } catch {
      // Invalid records fail closed and are not exposed.
    }
  }
  return products;
}

function toPublicProduct(product) {
  return {
    id: product.id,
    sku: product.sku || null,
    silo: product.silo,
    name: product.name,
    description: product.description || '',
    price: priceInMajorUnits(product),
    price_unit: 'major',
    currency: String(product.currency || 'NZD').toUpperCase(),
    inventory: Number(product.inventory ?? product.inventory_units ?? product.inventory_pixels),
    status: 'published',
    approval_required: false,
    checkout_available: true,
    checkout_url: checkoutUrl(product),
    sale_mode: 'checkout',
    gauntlet_status: 'PASS',
    fulfillment_status: 'READY'
  };
}

module.exports = {
  PUBLISHABLE_SILOS,
  isStripeUrl,
  checkoutUrl,
  priceInMajorUnits,
  evaluateCanonicalProduct,
  evaluateCanonicalDynamicCheckoutProduct,
  loadCanonicalCheckoutableProducts,
  toPublicProduct
};
