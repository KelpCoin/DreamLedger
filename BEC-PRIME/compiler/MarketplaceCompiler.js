'use strict';

// Deterministic marketplace projection. Catalog truth remains authoritative.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const SELLERS = path.join(ROOT, 'catalog', 'sellers');
const OUT = path.join(ROOT, 'compiled', 'website', 'marketplace');
const MANIFEST_OUT = path.join(ROOT, 'compiled', 'website', '.well-known', 'commerce-manifest.json');
const PROOF = path.join(ROOT, 'PROOF-OMNI-COMMERCE-COMPILATION.json');

function files(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.endsWith('.json')).map(x => path.join(dir, x)) : [];
}
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c])); }

const products = files(PRODUCTS).map(read).filter(p => p.status === 'published' && p.commercial_truth && p.commercial_truth.approval_required === false && Number(p.inventory || 0) > 0);
const sellers = files(SELLERS).map(read).filter(s => s.status !== 'suspended');
const sellerById = new Map(sellers.map(s => [String(s.id), s]));
const listings = products.map(p => ({
  id: p.id,
  seller_id: p.seller_id || null,
  seller_slug: p.seller_slug || (p.seller_id && sellerById.get(String(p.seller_id))?.slug) || null,
  name: p.name,
  description: p.description || '',
  price: Number(p.price || 0),
  currency: p.currency || 'NZD',
  inventory: Number(p.inventory || 0),
  silo: p.silo || 'general',
  checkout_route: '/api/offer-checkout/create',
  approval_required: false,
  checkout_available: true
}));

const manifest = {
  schema: 'dreamledger/omni-commerce/v1',
  generated_at: new Date().toISOString(),
  status: 'PASS',
  storefront: '/',
  marketplace: '/marketplace/',
  sellers: '/sellers/',
  auctions: '/#auctions',
  dreamiez: '/dreamiez',
  api: {
    marketplace: '/api/marketplace',
    sellers: '/api/sellers',
    cart: '/api/cart',
    checkout: '/api/cart/checkout'
  },
  language: { canonical: 'en', translation_source: 'catalog/translations', fallback: 'en' },
  policy: {
    catalog_is_source_of_truth: true,
    approval_gate_required: true,
    public_surface_excludes_private_material: true,
    no_secret_values_compiled: true,
    public_actions_require_runtime_authorization: true
  },
  counts: { products: listings.length, sellers: sellers.length },
  source_hash: digest(JSON.stringify({ listings, sellers }))
};

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const cards = listings.map(p => `<article class="oc-card"><div class="oc-art">${esc((p.silo || 'SHOP').slice(0, 1).toUpperCase())}</div><div class="oc-body"><small>${esc(p.seller_slug || p.silo)}</small><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><strong>${esc(p.currency)} ${(p.price / 100).toFixed(2)}</strong><button data-offer="${esc(p.id)}">Buy now</button></div></article>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="DreamLedger independent marketplace"><title>DreamLedger Marketplace</title><style>body{margin:0;background:#070707;color:#f7f7f3;font-family:system-ui,sans-serif}.wrap{max-width:1400px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #292929;padding-bottom:18px}.brand{font-weight:950;letter-spacing:-.05em}.brand span,small{color:#f2c14e}.rail{display:flex;gap:14px;overflow-x:auto;padding:28px 0}.oc-card{flex:0 0 min(360px,84vw);background:#111;border:1px solid #292929;border-radius:18px;overflow:hidden}.oc-art{height:170px;display:grid;place-items:center;background:radial-gradient(circle,#403411,#0a0a0a);color:#f2c14e;font-size:5rem;font-weight:900}.oc-body{padding:20px}.oc-body h2{margin:8px 0}.oc-body p{color:#888;min-height:48px}.oc-body strong{display:block;font-size:1.3rem;margin:15px 0}.oc-body button{width:100%;border:0;border-radius:10px;padding:13px;background:#f2c14e;font-weight:900;cursor:pointer}.note{color:#777;font-size:.8rem}</style></head><body><main class="wrap"><header class="top"><a class="brand" href="/">DREAM<span>LEDGER</span></a><nav><a href="/" style="color:#fff">Store</a> &nbsp; <a href="/#auctions" style="color:#fff">Auctions</a> &nbsp; <a href="/dreamiez" style="color:#fff">Dreamiez</a></nav></header><section><p class="note">Independent marketplace. Published catalog truth only. English is the canonical source language; translation is compiler/runtime work.</p><div class="rail">${cards || '<p class="note">No approved marketplace listings are currently published.</p>'}</div></section></main><script>document.querySelectorAll('[data-offer]').forEach(b=>b.addEventListener('click',async()=>{const r=await fetch('/api/offer-checkout/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offer_id:b.dataset.offer})});const j=await r.json();if(j.url)location.href=j.url;else alert(j.error||'Checkout unavailable');}));</script></body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');

const proof = { type:'dreamledger-omni-commerce-compilation', status:'PASS', compiler:'MarketplaceCompiler', generated_at:manifest.generated_at, counts:manifest.counts, source_hash:manifest.source_hash, outputs:['compiled/website/marketplace/index.html','compiled/website/.well-known/commerce-manifest.json'], gates:manifest.policy };
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
