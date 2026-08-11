'use strict';

// CUBE surface compiler: generate the public surface from versioned boilerplate
// and canonical catalogs. The compiled website is an output, never the source.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const ASSETS = path.join(OUT, 'assets');
const TEMPLATE_INDEX = path.join(__dirname, 'templates', 'public-index.html');
const TEMPLATE_MARKETPLACE = path.join(__dirname, 'templates', 'public-marketplace.js');
const INDEX = path.join(OUT, 'index.html');
const ASSET = path.join(ASSETS, 'public-marketplace.js');
const MANIFEST = path.join(ROOT, 'manifests', 'CUBE-PUBLIC-SURFACE-MANIFEST.json');
const OFFERS = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const IP = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const NEWS = path.join(ROOT, 'data', 'silo-news.json');
const AUCTIONS = path.join(ROOT, 'data', 'auctions.json');
const PROOF = path.join(ROOT, 'PROOF-CUBE-SURFACE-COMPILATION.json');

function must(file) {
  if (!fs.existsSync(file)) throw new Error(`CUBE surface input missing: ${path.relative(ROOT, file)}`);
}
function digestBuffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function digest(file) {
  return digestBuffer(fs.readFileSync(file));
}
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

[TEMPLATE_INDEX, TEMPLATE_MARKETPLACE, MANIFEST, OFFERS, IP, PRODUCTS, NEWS, AUCTIONS].forEach(must);

const manifest = json(MANIFEST);
const offers = json(OFFERS);
const ip = json(IP);
const news = json(NEWS);
const auctions = json(AUCTIONS);
const offerList = Array.isArray(offers) ? offers : offers.offers;
const capabilities = Array.isArray(ip) ? ip : ip.capabilities;
const productCount = fs.readdirSync(PRODUCTS).filter(x => x.endsWith('.json')).length;
const capabilityCount = capabilities.length;
const offerCount = offerList.length;
const auctionCount = Array.isArray(auctions) ? auctions.length : (auctions.auctions || []).length;

if (!Array.isArray(offerList)) throw new Error('CUBE surface input invalid: offers[] required');
if (!Array.isArray(capabilities)) throw new Error('CUBE surface input invalid: capabilities[] required');
if (manifest.surface_policy.approval_required_for_activation !== true) throw new Error('CUBE surface policy must require approval before activation');
if (manifest.surface_policy.private_material_excluded !== true) throw new Error('CUBE surface policy must exclude private material');
if (manifest.surface_policy.silo_isolation_required !== true) throw new Error('CUBE surface policy must require silo isolation');

for (const offer of offerList) {
  if (offer.approval_required !== true) throw new Error(`CUBE refuses unlocked offer: ${offer.offer_id}`);
  if (offer.checkout_available !== false) throw new Error(`CUBE refuses checkout-enabled compiled offer: ${offer.offer_id}`);
  if (offer.status !== 'candidate') throw new Error(`CUBE refuses non-candidate offer: ${offer.offer_id}`);
  if (offer.provenance?.private_material !== 'excluded') throw new Error(`CUBE refuses private-material offer: ${offer.offer_id}`);
}

const templateIndex = fs.readFileSync(TEMPLATE_INDEX, 'utf8');
const templateMarketplace = fs.readFileSync(TEMPLATE_MARKETPLACE, 'utf8');
if (!templateIndex.includes('compiler-generated public surface')) throw new Error('CUBE index template missing compiler marker');
if (!templateIndex.includes('/api/offers')) throw new Error('CUBE index template missing canonical offer API surface');
if (!templateMarketplace.includes('/api/offers')) throw new Error('CUBE marketplace template missing canonical offer API');
if (!templateMarketplace.includes('/api/offer-checkout/create')) throw new Error('CUBE marketplace template missing governed checkout route');

// No timestamps, random IDs, or runtime state are injected into public output.
// This makes the compilation output reproducible from the same source inputs.
write(INDEX, templateIndex);
write(ASSET, templateMarketplace);

const build = {
  type: 'dreamledger-cube-surface-compilation',
  status: 'PASS',
  compiler: 'CUBE',
  schema: manifest.schema,
  deterministic: true,
  generated_from_templates: true,
  source_of_public_economics: 'catalog/offers/offers.json',
  source_of_public_capabilities: 'catalog/ip-capabilities.json',
  source_hashes: {
    manifest: digest(MANIFEST),
    offers: digest(OFFERS),
    ip: digest(IP),
    news: digest(NEWS),
    auctions: digest(AUCTIONS),
    index_template: digest(TEMPLATE_INDEX),
    marketplace_template: digest(TEMPLATE_MARKETPLACE)
  },
  output_hashes: {
    index: digest(INDEX),
    marketplace_runtime: digest(ASSET)
  },
  counts: { capabilities: capabilityCount, offers: offerCount, products: productCount, news_silos: Object.keys(news).length, auctions: auctionCount },
  required_public_surfaces: manifest.public_surfaces,
  gates: {
    approval_required_for_activation: manifest.surface_policy.approval_required_for_activation === true,
    private_material_excluded: manifest.surface_policy.private_material_excluded === true,
    silo_isolation_required: manifest.surface_policy.silo_isolation_required === true,
    all_compiled_offers_locked: offerList.every(o => o.approval_required === true && o.checkout_available === false)
  }
};

write(PROOF, JSON.stringify(build, null, 2) + '\n');
console.log(JSON.stringify(build, null, 2));
