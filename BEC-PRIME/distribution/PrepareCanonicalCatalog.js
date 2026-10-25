'use strict';

// Adapts the canonical BEC product catalogue into draft-only channel syndication.
// Fails closed unless the canonical product, checkout route and fulfillment registry agree.
// No network calls, publication, checkout mutation or payment movement occur here.
const fs = require('node:fs');
const path = require('node:path');
const { compileMany } = require('./CompileChannelSyndication');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'catalog', 'products');
const FULFILLMENT_FILE = path.join(ROOT, 'fulfillment', 'PRODUCT-FULFILLMENT-REGISTRY.json');
const CONFIG_FILE = path.join(__dirname, 'channel-syndication-v1.json');
const DEFAULT_OUT = path.join(__dirname, 'proof', 'CANONICAL-CATALOG-SYNDICATION-PROOF.json');
const BASE_URL = 'https://dreamledger.org';

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function priceMajor(p) {
  const n = Number(p.price);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = String(p.price_unit || 'major').toLowerCase();
  if (unit === 'minor' || unit === 'cents') return n / 100;
  if (unit === 'major') return n;
  return null;
}
function productType(p) {
  if (p.inventory_type === 'physical' || p.product_type === 'physical_goods') return 'physical_goods';
  const mode = String(p.fulfillment && p.fulfillment.mode || '').toLowerCase();
  if (mode === 'digital_download') return 'digital_download';
  if (mode.includes('diagnostic')) return 'digital_diagnostic';
  if (mode && mode !== 'disabled') return 'custom_service';
  return null;
}
function canonicalSourceUrl(p) {
  const raw = p.public_url || (p.checkout && p.checkout.url) || '';
  if (!raw || typeof raw !== 'string') return null;
  if (/^https:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/') && !raw.startsWith('//')) return new URL(raw, BASE_URL).toString();
  return null;
}
function siloFor(p) {
  const silo = String(p.silo || '').trim().toLowerCase();
  return silo === 'digital' ? 'digital_goods' : silo;
}
function adaptProduct(p, registry) {
  const reasons = [];
  const id = String(p.id || p.product_id || '').trim();
  if (!id) reasons.push('MISSING_PRODUCT_ID');
  if (p.status !== 'published') reasons.push('PRODUCT_NOT_PUBLISHED');
  if (!p.commercial_truth || p.commercial_truth.sellable !== true) reasons.push('CANONICAL_SELLABLE_NOT_TRUE');
  if (!p.commercial_truth || p.commercial_truth.approval_required !== false) reasons.push('CANONICAL_APPROVAL_REQUIRED');
  const f = registry.entries && (registry.entries[p.offer_id] || registry.entries[id]);
  if (!f || f.ready !== true || f.operator_required !== false) reasons.push('VERIFIED_ZERO_HUMAN_FULFILLMENT_NOT_READY');
  const type = productType(p);
  if (!type) reasons.push('SUPPORTED_DELIVERY_TYPE_MISSING');
  const price = priceMajor(p);
  if (price === null) reasons.push('PRICE_OR_PRICE_UNIT_INVALID');
  const sourceUrl = canonicalSourceUrl(p);
  if (!sourceUrl) reasons.push('CANONICAL_PUBLIC_SOURCE_URL_MISSING');
  const silo = siloFor(p);
  if (!silo) reasons.push('SILO_ID_MISSING');
  if (['amplissa', 'adult', 'adult_silo', 'amplissa_adult'].includes(String(silo || '').toLowerCase())) reasons.push('ADULT_SILO_REQUIRES_SEPARATE_ISOLATED_ENGINE');
  if (type === 'physical_goods' && (!Number.isInteger(Number(p.inventory)) || Number(p.inventory) < 1)) reasons.push('PHYSICAL_STOCK_NOT_PROVEN');
  if (reasons.length) return { product_id: id || null, name: p.name || null, status: 'BLOCKED', reasons };
  return {
    product: {
      product_id: id,
      silo_id: silo,
      title: String(p.name).trim(),
      description: String(p.description || p.name).trim(),
      product_type: type,
      price: 'NZD ' + price.toFixed(2),
      source_url: sourceUrl,
      delivery_spec: JSON.stringify(p.fulfillment),
      ...(type === 'physical_goods' ? { inventory_count: Number(p.inventory) } : {})
    },
    status: 'ELIGIBLE_FOR_DRAFT_COMPILATION',
    product_id: id,
    name: p.name
  };
}
function run({ productsDir = PRODUCTS_DIR, fulfillmentFile = FULFILLMENT_FILE, configFile = CONFIG_FILE, outputFile = DEFAULT_OUT, generatedAt = new Date().toISOString() } = {}) {
  const registry = readJson(fulfillmentFile);
  const config = readJson(configFile);
  const files = fs.readdirSync(productsDir).filter(x => x.toLowerCase().endsWith('.json')).sort();
  const records = files.map(file => ({ file, product: readJson(path.join(productsDir, file)) }));
  const adapted = records.map(({ file, product }) => ({ file, ...adaptProduct(product, registry) }));
  const eligible = adapted.filter(x => x.product).map(x => x.product);
  const compiled = eligible.length ? compileMany(eligible, config, generatedAt) : {
    schema_version: 'DL-SYNDICATION-MULTI-BATCH-1.0',
    generated_at: generatedAt,
    truth_label: 'DRAFT_ONLY_NOT_PUBLISHED_NOT_REVENUE',
    counts: { products_considered: 0, channels_considered: 0, compatible_drafts: 0, incompatible_skips: 0, published: 0 },
    policy: { public_action_allowed: false, money_movement_allowed: false, price_change_allowed: false },
    products: []
  };
  const proof = {
    schema_version: 'DL-CANONICAL-CATALOG-SYNDICATION-PROOF-1.0',
    generated_at: generatedAt,
    status: 'PASS',
    truth_label: 'LOCAL_CATALOG_ADAPTATION_ONLY_NO_PUBLICATION_NO_REVENUE',
    source: {
      products_dir: path.relative(ROOT, productsDir),
      fulfillment_registry: path.relative(ROOT, fulfillmentFile),
      product_files_sha256: require('node:crypto').createHash('sha256').update(records.map(x => x.file + ':' + JSON.stringify(x.product)).join('\n')).digest('hex')
    },
    counts: {
      source_products: records.length,
      eligible_for_draft_compilation: eligible.length,
      blocked: adapted.filter(x => x.status === 'BLOCKED').length,
      compatible_channel_drafts: compiled.counts.compatible_drafts,
      published: 0
    },
    policy: { public_action_allowed: false, money_movement_allowed: false, checkout_mutation_allowed: false, external_network_calls: false },
    blocked_products: adapted.filter(x => x.status === 'BLOCKED').map(({ file, product_id, name, reasons }) => ({ file, product_id, name, reasons })),
    compilation: compiled
  };
  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  }
  return proof;
}
if (require.main === module) {
  try {
    const output = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
    const proof = run({ outputFile: output });
    process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
  } catch (e) {
    process.stderr.write(String(e.code || e.message) + '\n');
    process.exitCode = 1;
  }
}
module.exports = { run, adaptProduct, productType, canonicalSourceUrl, priceMajor };
