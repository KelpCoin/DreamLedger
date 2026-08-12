'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const OUT_DIR = path.join(ROOT, 'catalog', 'offers');
const OUT_FILE = path.join(OUT_DIR, 'products.json');
const PROOF_FILE = path.join(ROOT, 'PROOF-PRODUCT-COMPILATION.json');

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function compile() {
  if (!fs.existsSync(PRODUCT_DIR)) throw new Error('Product catalog missing');
  const products = fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).sort().map(x => read(path.join(PRODUCT_DIR, x)));
  const offers = products.map(p => ({
    offer_id: p.id,
    version: 'product-offer-v1',
    capability_id: `PRODUCT-${p.id}`,
    silo: p.silo,
    name: p.name,
    problem: `Purchase ${p.name}.`,
    input: 'No additional input required.',
    output: p.description || p.name,
    offer_type: 'product',
    delivery_mechanism: p.checkout?.mode === 'payment' ? 'physical_delivery_or_defined_product_delivery' : 'product_delivery',
    deliverable: p.description || p.name,
    target_buyer: 'Buyer seeking the published product.',
    eligibility: 'Available while published inventory remains positive.',
    price: Number(p.price) / 100,
    currency: String(p.currency || 'nzd').toUpperCase(),
    pricing_strategy: 'fixed',
    payment_adapter: 'stripe',
    checkout_route: '/api/checkout/create',
    approval_required: p.commercial_truth?.approval_required === true,
    checkout_available: p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0,
    status: p.status === 'published' && Number(p.inventory || 0) > 0 ? 'VERIFIED_AVAILABLE' : 'unavailable',
    proof_of_delivery: 'stripe_payment_plus_durable_transaction_proof',
    verification_rules: ['canonical_product', 'explicit_operator_approval', 'inventory_positive', 'stripe_checkout', 'webhook_proof'],
    provenance: { source: `catalog/products/${p.id}.json`, private_material: 'excluded' }
  }));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { schema: 'BEC-PRIME/PRODUCT-OFFER-CATALOG/v1', compiler: 'product-compiler-v1', source: 'catalog/products/*.json', count: offers.length, source_hash: sha256(JSON.stringify(products)), offers };
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const proof = { type: 'dreamledger-product-compilation-proof', status: 'PASS', compiler: 'product-compiler-v1', source_hash: manifest.source_hash, product_count: products.length, checkoutable_product_ids: offers.filter(x => x.checkout_available).map(x => x.offer_id) };
  fs.writeFileSync(PROOF_FILE, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return manifest;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile };
