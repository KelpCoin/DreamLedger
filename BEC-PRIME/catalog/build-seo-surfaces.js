'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const productDir = path.join(ROOT, 'catalog', 'products');
const outRoot = path.join(ROOT, 'compiled', 'website', 'products');
const base = 'https://dreamledger.org';

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function esc(s) { return String(s ?? '').replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c])); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const products = fs.existsSync(productDir) ? fs.readdirSync(productDir).filter(x => x.endsWith('.json')).map(x => readJson(path.join(productDir, x))).filter(p => p.status === 'published' && p.commercial_truth?.approval_required !== true) : [];
fs.mkdirSync(outRoot, { recursive: true });

for (const p of products) {
  const id = slug(p.id);
  const dir = path.join(outRoot, id);
  fs.mkdirSync(dir, { recursive: true });
  const url = `${base}/products/${id}/`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    sku: p.id,
    brand: { '@type': 'Brand', name: p.silo === 'SILO_MTG' ? 'HappyHomarid Master Sellers' : 'DreamLedger' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: String(p.currency || 'NZD').toUpperCase(),
      price: Number(p.price || 0) / 100,
      availability: Number(p.inventory || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: p.silo === 'SILO_MTG' ? 'HappyHomarid Master Sellers' : 'DreamLedger' }
    }
  };
  const html = `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)} | DreamLedger</title><meta name="description" content="${esc(p.description)}"><link rel="canonical" href="${url}"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><main><p>${esc(p.silo)}</p><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p><p><strong>${esc(p.currency)} ${(Number(p.price || 0) / 100).toFixed(2)}</strong></p><p>Availability: ${Number(p.inventory || 0) > 0 ? 'In stock' : 'Unavailable'}</p><a href="${base}/${p.silo === 'SILO_MTG' ? 'mtg/' : 'shop/'}">Return to catalogue</a></main></body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html + '\n');
}

const urls = [`${base}/`, `${base}/shop/`, `${base}/mtg/`, `${base}/trust-engine.html`, ...products.map(p => `${base}/products/${slug(p.id)}/`)];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'compiled', 'website', 'sitemap.xml'), xml);
console.log(JSON.stringify({ status: 'PASS', published_product_pages: products.length, sitemap_urls: urls.length }, null, 2));
