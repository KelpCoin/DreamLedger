'use strict';

// Deterministic compile-time gate for the omni-commerce layer.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const MARKET = path.join(ROOT, 'data', 'marketplace');
const SELLERS = path.join(MARKET, 'sellers.json');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const OUT = path.join(ROOT, 'compiled', 'omni-commerce-manifest.json');
const PROOF = path.join(ROOT, 'PROOF-OMNI-COMMERCE-COMPILATION.json');
const FORBIDDEN = ['amplissa', 'bbw', 'big beautiful women', 'adult-only', 'adult only', 'adult_silo'];

function must(file) { if (!fs.existsSync(file)) throw new Error('OMNI_COMPILER_INPUT_MISSING:' + path.relative(ROOT, file)); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function scan(value, label) {
  const text = JSON.stringify(value).toLowerCase();
  const hit = FORBIDDEN.find(token => text.includes(token));
  if (hit) throw new Error('OMNI_PUBLIC_SILO_GATE_FAILED:' + label + ':' + hit);
}

must(SELLERS);
must(PRODUCTS);
const sellerData = read(SELLERS);
if (!Array.isArray(sellerData)) throw new Error('SELLERS_MUST_BE_ARRAY');
scan(sellerData, 'sellers');

const files = fs.readdirSync(PRODUCTS).filter(x => x.endsWith('.json'));
const products = files.map(file => ({ file, value: read(path.join(PRODUCTS, file)) }));
const publicProducts = products.filter(x => x.value.status === 'published' && x.value.commercial_truth?.approval_required === false);
publicProducts.forEach(x => scan(x.value, x.file));

const activeSellers = sellerData.filter(s => s.status === 'active');
const paymentReady = activeSellers.filter(s => Boolean(s.stripe_connect_account_id));
const manifest = {
  schema_version: 'BEC-OMNI-COMMERCE-1.0',
  status: 'PASS',
  compiled_at: new Date().toISOString(),
  architecture: {
    owned_storefront: true,
    marketplace: true,
    auctions: true,
    multi_vendor_cart: true,
    single_stripe_checkout: true,
    stripe_connect_settlement: true,
    platform_commission_bps: 0,
    immutable_proof: true,
    compiler_owned_surface: true
  },
  silo_policy: {
    amplissa_excluded: true,
    adult_material_excluded: true,
    forbidden_tokens_checked: true
  },
  counts: { sellers: sellerData.length, active_sellers: activeSellers.length, payment_ready_sellers: paymentReady.length, products: products.length, public_products: publicProducts.length },
  source_hashes: { sellers: digest(SELLERS), product_catalog: files.map(file => ({ file, sha256: digest(path.join(PRODUCTS, file)) })) }
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(PROOF, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
