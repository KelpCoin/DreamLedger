#!/usr/bin/env node
/**
 * Regenerates public/buy/{slug}/index.html from live or local product list.
 * Usage: node scripts/sync-public-buy-pages.mjs
 * Prefers https://dreamledger.org/api/products checkout_url values.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const buyRoot = path.join(root, 'public', 'buy');

function slugify(id) {
  return String(id).toLowerCase().replace(/_/g, '-');
}

function pageHtml(productId, checkoutUrl) {
  const ref = encodeURIComponent(productId);
  const url = `${checkoutUrl}?client_reference_id=${ref}&utm_source=dreamledger&utm_medium=machine-commerce&utm_campaign=${ref}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening DreamLedger checkout</title></head><body><p>Opening secure checkout…</p><script>location.replace(${JSON.stringify(url)})</script></body></html>\n`;
}

const res = await fetch('https://dreamledger.org/api/products');
if (!res.ok) throw new Error('Failed to fetch /api/products: ' + res.status);
const data = await res.json();
const products = (data.products || []).filter((p) => p && p.checkout_url && p.status === 'published');

let written = 0;
for (const p of products) {
  const slug = slugify(p.id);
  const dir = path.join(buyRoot, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(p.id, p.checkout_url));
  written++;
  console.log('wrote', slug, '->', p.checkout_url);
}
console.log('done', written, 'buy pages');
