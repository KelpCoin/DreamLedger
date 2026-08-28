'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const originalCreateServer = http.createServer;
const crypto = require('crypto');

const PUBLIC_ROOT = path.join(__dirname, '..', 'compiled', 'website');
const MTG_FILE = path.join(PUBLIC_ROOT, 'mtg', 'index.html');

// MTG price contract: product records are major NZD units by default.
// Preserve the one explicitly legacy minor-unit SKU already present in the catalog.
const LEGACY_MINOR_IDS = new Set([
  'MTG-URZAS-LEGACY-PALINCHRON-FOIL-001'
]);

function mtgPriceMinor(product) {
  const raw = Number(product && product.price);
  if (!Number.isFinite(raw) || raw < 0) throw new Error('Invalid MTG product price');
  const unit = String(product && product.price_unit || '').toLowerCase();
  if (unit === 'minor' || unit === 'cents' || LEGACY_MINOR_IDS.has(String(product.id))) return Math.round(raw);
  return Math.round(raw * 100);
}

// The canonical product checkout already exists. This preload hardens the MTG
// path so legacy/minor and current/major price records cannot be confused.
try {
  const platformCart = require('../routes/platformCart');
  const originalCreateProductCheckout = platformCart.createProductCheckout;
  platformCart.createProductCheckout = async function mtgSafeCreateProductCheckout(productId, silo) {
    if (String(silo || '').toLowerCase() !== 'mtg') return originalCreateProductCheckout(productId, silo);

    const catalogFile = path.join(__dirname, '..', 'catalog', 'products', String(productId) + '.json');
    if (!fs.existsSync(catalogFile)) throw new Error('Product is not checkoutable');
    const product = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
    if (String(product.silo || '').toLowerCase() !== 'mtg') return originalCreateProductCheckout(productId, silo);
    if (product.status !== 'published' || Number(product.inventory || 0) < 1 || product.commercial_truth?.approval_required !== false) {
      throw new Error('Product is not checkoutable');
    }

    const secret = String(process.env.STRIPE_SECRET_KEY || '');
    if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured');
    const base = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
    const cartId = 'direct_' + crypto.randomUUID();
    const params = new URLSearchParams();
    const set = (k, v) => params.set(k, String(v));
    set('mode', 'payment');
    set('success_url', base + '/checkout/success?product_id=' + encodeURIComponent(product.id));
    set('cancel_url', base + '/mtg?checkout_cancelled=1');
    set('metadata[product_id]', product.id);
    set('metadata[silo]', 'mtg');
    set('metadata[commerce_version]', 'bec-mtg-direct-v2');
    set('line_items[0][price_data][currency]', String(product.currency || 'nzd').toLowerCase());
    set('line_items[0][price_data][unit_amount]', mtgPriceMinor(product));
    set('line_items[0][price_data][product_data][name]', product.name);
    set('line_items[0][price_data][product_data][metadata][product_id]', product.id);
    set('line_items[0][price_data][product_data][metadata][silo]', 'mtg');
    set('line_items[0][quantity]', 1);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secret,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': 'dreamledger-mtg-direct-' + product.id + '-' + cartId
      },
      body: params
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!response.ok) throw new Error(data?.error?.message || 'Stripe checkout creation failed');
    return {
      ok: true,
      offer_id: product.id,
      session_id: data.id,
      checkout_url: data.url,
      url: data.url,
      amount_minor: mtgPriceMinor(product),
      currency: String(product.currency || 'nzd').toLowerCase()
    };
  };
} catch (err) {
  console.error('MTG_PRELOAD_PATCH_FAILED', err && err.message ? err.message : err);
}

function sendNotFound(res){
  res.writeHead(404, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'Not found'}));
  return true;
}
function serveMtg(req, res) {
  if (!req || req.method !== 'GET') return false;
  const raw = String(req.url || '').split('?')[0];
  if (raw === '/cinema.html' || raw === '/cinema' || raw === '/dreamiez' || raw === '/dreamiez/' || raw.startsWith('/dreamiez/')) return sendNotFound(res);
  if (raw.toLowerCase() !== '/mtg' && raw.toLowerCase() !== '/mtg/') return false;
  if (!fs.existsSync(MTG_FILE)) return false;
  const payload = fs.readFileSync(MTG_FILE);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.length)
  });
  res.end(payload);
  return true;
}
http.createServer = function mtgRouteCompatibleCreateServer(handler) {
  const wrapped = typeof handler === 'function'
    ? function(req, res) {
        if (serveMtg(req, res)) return;
        return handler(req, res);
      }
    : handler;
  return originalCreateServer.call(this, wrapped);
};
