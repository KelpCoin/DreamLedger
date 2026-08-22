'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const OUT_DIR = path.join(ROOT, 'catalog', 'offers');
const OUT_FILE = path.join(OUT_DIR, 'products.json');
const PROOF_FILE = path.join(ROOT, 'PROOF-PRODUCT-COMPILATION.json');
const FULFILLMENT_FILE = path.join(ROOT, 'fulfillment', 'PRODUCT-FULFILLMENT-REGISTRY.json');

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function priceInMajorUnits(product) {
  const value = Number(product.price);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid product price for ${product.id}`);
  const unit = String(product.price_unit || 'major').toLowerCase();
  if (unit === 'minor' || unit === 'cents') return value / 100;
  return value;
}

function fulfillmentReady(product, registry) {
  const f = registry.entries[product.id];
  if (!f || f.ready !== true) return { ready: false, reason: 'NO_FULFILLMENT_CONTRACT' };
  if (f.type === 'physical_inventory' && Number(product.inventory || 0) <= 0) return { ready: false, reason: 'NO_POSITIVE_INVENTORY' };
  if (f.type === 'report_template') {
    const templatePath = path.join(ROOT, '..', f.template);
    if (!fs.existsSync(templatePath)) return { ready: false, reason: 'FULFILLMENT_TEMPLATE_MISSING' };
  }
  if (f.type === 'service_activation' && !f.delivery_target) return { ready: false, reason: 'DELIVERY_TARGET_MISSING' };
  return { ready: true, reason: null, contract: f };
}

function compile() {
  if (!fs.existsSync(PRODUCT_DIR)) throw new Error('Product catalog missing');
  if (!fs.existsSync(FULFILLMENT_FILE)) throw new Error('Product fulfillment registry missing');

  const registry = read(FULFILLMENT_FILE);
  const products = fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).sort().map(x => read(path.join(PRODUCT_DIR, x)));

  const offers = products.map(p => {
    const f = fulfillmentReady(p, registry);
    const price = priceInMajorUnits(p);
    const checkoutAvailable = p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0 && f.ready;
    return {
      offer_id: p.id,
      version: 'product-offer-v3',
      capability_id: p.capability_id || `PRODUCT-${p.id}`,
      silo: p.silo,
      name: p.name,
      problem: `Purchase ${p.name}.`,
      input: 'Buyer input defined by the fulfillment contract.',
      output: p.description || p.name,
      offer_type: 'product',
      delivery_mechanism: f.ready ? f.contract.type : 'blocked_until_fulfillment_ready',
      deliverable: f.ready ? (f.contract.template || f.contract.delivery_target || f.contract.delivery) : null,
      target_buyer: 'Buyer seeking the published product.',
      eligibility: 'Available only when payment and fulfillment prerequisites are satisfied.',
      price,
      currency: String(p.currency || 'nzd').toUpperCase(),
      price_unit: 'major',
      pricing_strategy: 'fixed',
      payment_adapter: 'stripe',
      checkout_route: '/api/offer-checkout/create',
      approval_required: p.commercial_truth?.approval_required === true,
      checkout_available: checkoutAvailable,
      status: checkoutAvailable ? 'VERIFIED_AVAILABLE' : (p.status === 'published' ? 'QUARANTINED_NO_FULFILLMENT' : 'unavailable'),
      fulfillment_ready: f.ready,
      fulfillment_block_reason: f.reason,
      proof_of_delivery: 'payment_plus_fulfillment_record_plus_transaction_proof',
      verification_rules: ['canonical_product', 'explicit_operator_approval', 'inventory_positive', 'fulfillment_contract_ready', 'stripe_checkout', 'webhook_proof'],
      provenance: { source: `catalog/products/${p.id}.json`, private_material: 'excluded' }
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {
    schema: 'BEC-PRIME/PRODUCT-OFFER-CATALOG/v3',
    compiler: 'product-compiler-v3-major-unit-safe',
    source: 'catalog/products/*.json',
    fulfillment_registry: 'fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json',
    count: offers.length,
    checkoutable_count: offers.filter(x => x.checkout_available).length,
    source_hash: sha256(JSON.stringify(products)),
    price_contract: 'major_units_by_default; minor/cents only when price_unit explicitly declares it',
    offers
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const proof = {
    type: 'dreamledger-product-compilation-proof',
    status: 'PASS',
    compiler: 'product-compiler-v3-major-unit-safe',
    source_hash: manifest.source_hash,
    price_contract: manifest.price_contract,
    product_count: products.length,
    checkoutable_product_ids: offers.filter(x => x.checkout_available).map(x => x.offer_id),
    quarantined_published_product_ids: offers.filter(x => x.status === 'QUARANTINED_NO_FULFILLMENT').map(x => x.offer_id)
  };
  fs.writeFileSync(PROOF_FILE, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return manifest;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile, priceInMajorUnits };
