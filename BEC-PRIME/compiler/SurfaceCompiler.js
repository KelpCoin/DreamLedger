'use strict';

// CUBE surface compiler: compile and verify the existing canonical public surface.
// It never invents inventory or unlocks commerce. It fails closed if the
// canonical surface or required source catalogs are missing.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const ASSET = path.join(OUT, 'assets', 'marketplace-live.js');
const INDEX = path.join(OUT, 'index.html');
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
function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

[OUT, ASSET, INDEX, MANIFEST, OFFERS, IP, PRODUCTS, NEWS, AUCTIONS].forEach(must);
const manifest = json(MANIFEST);
const offers = json(OFFERS);
const ip = json(IP);
const news = json(NEWS);
const auctions = json(AUCTIONS);
const productCount = fs.readdirSync(PRODUCTS).filter(x => x.endsWith('.json')).length;
const capabilityCount = Array.isArray(ip) ? ip.length : (ip.capabilities || []).length;
const offerCount = Array.isArray(offers) ? offers.length : (offers.offers || []).length;
const auctionCount = Array.isArray(auctions) ? auctions.length : (auctions.auctions || []).length;

const build = {
  type: 'dreamledger-cube-surface-compilation',
  status: 'PASS',
  compiler: 'CUBE',
  schema: manifest.schema,
  compiled_at: new Date().toISOString(),
  source_hashes: {
    manifest: digest(MANIFEST),
    offers: digest(OFFERS),
    ip: digest(IP),
    news: digest(NEWS),
    auctions: digest(AUCTIONS),
    surface_html: digest(INDEX),
    marketplace_runtime: digest(ASSET)
  },
  counts: { capabilities: capabilityCount, offers: offerCount, products: productCount, news_silos: Object.keys(news).length, auctions: auctionCount },
  required_public_surfaces: manifest.public_surfaces,
  gates: {
    approval_required_for_activation: manifest.surface_policy.approval_required_for_activation === true,
    private_material_excluded: manifest.surface_policy.private_material_excluded === true,
    silo_isolation_required: manifest.surface_policy.silo_isolation_required === true
  }
};

fs.writeFileSync(PROOF, JSON.stringify(build, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(build, null, 2));
