'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateCatalogProduct } = require('../elohim/validateElohimProduct');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const OUT_DIR = path.join(ROOT, 'catalog', 'offers');
const OUT_FILE = path.join(OUT_DIR, 'products.json');
const PROOF_FILE = path.join(ROOT, 'PROOF-PRODUCT-COMPILATION.json');
const FULFILLMENT_FILE = path.join(ROOT, 'fulfillment', 'PRODUCT-FULFILLMENT-REGISTRY.json');

const LEGACY_MINOR_DEFAULT_IDS = new Set([
  'BILLBOARD-LARGE','BILLBOARD-MEDIUM','BILLBOARD-SMALL','BILLBOARD-TAKEOVER','BILLBOARD-WIDE',
  'DREAMIEZ-BEAUTY-BRUSH-001','DREAMIEZ-BEAUTY-MIRROR-001','DREAMIEZ-BEAUTY-POUCH-001','DREAMIEZ-BEAUTY-VANITY-001',
  'DREAMIEZ-cape','DREAMIEZ-cosmic-hoodie','DREAMIEZ-dragon-tattoo','DREAMIEZ-flower-crown','DREAMIEZ-neon-sneakers',
  'DREAMIEZ-ninja-mask','DREAMIEZ-pink-hair','DREAMIEZ-pirate-hat','DREAMIEZ-sunglasses','DREAMIEZ-top-hat',
  'DREAMIEZ-tuxedo','DREAMIEZ-viking-helmet',
  'DREAMLEDGER-BILLBOARD-LARGE-001','DREAMLEDGER-BILLBOARD-MEDIUM-001','DREAMLEDGER-BILLBOARD-SMALL-001','DREAMLEDGER-BILLBOARD-WIDE-001',
  'MTG-URZAS-LEGACY-PALINCHRON-FOIL-001'
]);

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function resolvePriceUnit(product) {
  if (product.price_unit) return { unit: String(product.price_unit).toLowerCase(), implicit: false };
  if (LEGACY_MINOR_DEFAULT_IDS.has(product.id)) return { unit: 'minor', implicit: true };
  return { unit: 'major', implicit: true };
}
function priceInMajorUnits(product) {
  const value = Number(product.price);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid product price for ${product.id}`);
  const resolved = resolvePriceUnit(product);
  if (resolved.unit === 'minor' || resolved.unit === 'cents') return value / 100;
  if (resolved.unit !== 'major') throw new Error(`Unsupported price_unit for ${product.id}: ${resolved.unit}`);
  return value;
}
function inventoryPositive(product) {
  if (Number(product.inventory) > 0) return true;
  if (Number(product.inventory_units) > 0) return true;
  if (Number(product.inventory_pixels) > 0 && Number(product.placement_pixels) > 0) return true;
  return false;
}
function fulfillmentReady(product, registry) {
  const f = registry.entries[product.offer_id] || registry.entries[product.id];
  if (!f || f.ready !== true) {
    return { ready: false, reason: f ? (f.block_reason || 'fulfillment_not_ready') : 'missing_fulfillment_contract', contract: f || null };
  }
  return { ready: true, reason: null, contract: f };
}

function compile() {
  if (!fs.existsSync(PRODUCT_DIR)) throw new Error('Product catalog missing');
  if (!fs.existsSync(FULFILLMENT_FILE)) throw new Error('Product fulfillment registry missing');

  const registry = read(FULFILLMENT_FILE);
  const products = fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).sort().map(x => read(path.join(PRODUCT_DIR, x)));

  const schemaQuarantineIds = [];

  const offers = products.map(p => {
    const schema = validateCatalogProduct(p);
    const f = fulfillmentReady(p, registry);
    const resolvedPrice = resolvePriceUnit(p);
    let price;
    try {
      price = priceInMajorUnits(p);
    } catch (e) {
      schemaQuarantineIds.push(p.id);
      return {
        offer_id: p.offer_id || p.id,
        product_id: p.id,
        version: 'product-offer-v3',
        status: 'QUARANTINED_SCHEMA',
        checkout_available: false,
        schema_validation: schema,
        error: e.message
      };
    }

    if (!schema.ok) {
      schemaQuarantineIds.push(p.id);
    }

    const checkoutAvailable = schema.ok
      && p.status === 'published'
      && p.commercial_truth?.approval_required === false
      && p.commercial_truth?.sellable === true
      && p.checkout?.mode !== 'disabled'
      && inventoryPositive(p)
      && f.ready;

    let status;
    if (!schema.ok) status = 'QUARANTINED_SCHEMA';
    else if (checkoutAvailable) status = 'VERIFIED_AVAILABLE';
    else if (p.status === 'held' && /price.{0,30}conflict|conflict.{0,30}price/i.test(String(p.hold_reason || p.commercial_truth?.reason || ''))) status = 'HELD_PRICE_CONFLICT';
    else if (p.status === 'held') status = 'HELD_NOT_RELEASED';
    else if (p.status === 'published') status = 'QUARANTINED_NO_FULFILLMENT';
    else status = 'unavailable';

    return {
      offer_id: p.offer_id || p.id,
      product_id: p.id,
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
      source_price_unit: resolvedPrice.unit,
      source_price_unit_implicit: resolvedPrice.implicit,
      pricing_strategy: 'fixed',
      payment_adapter: checkoutAvailable ? 'stripe' : 'disabled_until_approved',
      checkout_route: checkoutAvailable
        ? (p.checkout?.mode === 'payment_link' ? 'stripe_payment_link' : '/api/offer-checkout/create')
        : null,
      checkout_url: checkoutAvailable ? (p.commercial_truth?.payment_link || null) : null,
      approval_required: p.commercial_truth?.approval_required !== false,
      checkout_available: checkoutAvailable,
      status,
      fulfillment_ready: f.ready,
      fulfillment_block_reason: f.reason,
      schema_validation: { ok: schema.ok, errors: schema.errors, warnings: schema.warnings },
      proof_of_delivery: 'payment_plus_fulfillment_record_plus_transaction_proof',
      verification_rules: ['canonical_product', 'schema_validation', 'explicit_operator_approval', 'inventory_positive', 'fulfillment_contract_ready', 'stripe_checkout', 'webhook_proof'],
      provenance: { source: `catalog/products/${p.id}.json`, private_material: 'excluded' }
    };
  });

  const implicitLegacyCount = offers.filter(x => x.source_price_unit_implicit).length;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {
    schema: 'BEC-PRIME/PRODUCT-OFFER-CATALOG/v3',
    compiler: 'product-compiler-v4-schema-gated',
    source: 'catalog/products/*.json',
    fulfillment_registry: 'fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json',
    count: offers.length,
    checkoutable_count: offers.filter(x => x.checkout_available).length,
    schema_quarantine_count: schemaQuarantineIds.length,
    source_hash: sha256(JSON.stringify(products)),
    price_contract: 'major_units_by_default; legacy allowlist remains minor until explicit price_unit migration',
    implicit_legacy_price_unit_count: implicitLegacyCount,
    offers
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const proof = {
    type: 'dreamledger-product-compilation-proof',
    status: 'PASS',
    compiler: 'product-compiler-v4-schema-gated',
    source_hash: manifest.source_hash,
    price_contract: manifest.price_contract,
    implicit_legacy_price_unit_count: implicitLegacyCount,
    product_count: products.length,
    checkoutable_product_ids: offers.filter(x => x.checkout_available).map(x => x.offer_id),
    quarantined_published_product_ids: offers.filter(x => x.status === 'QUARANTINED_NO_FULFILLMENT').map(x => x.offer_id),
    quarantined_schema_product_ids: schemaQuarantineIds
  };
  fs.writeFileSync(PROOF_FILE, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return manifest;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile, priceInMajorUnits, resolvePriceUnit, inventoryPositive };
