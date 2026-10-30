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
  // This physical-commerce route must never bypass the shared atomic stock reservation.
  // Do not turn it on via an environment variable. Wire a durable, tenant-scoped
  // reservation and idempotent order transition before reopening MTG checkout.
  platformCart.createProductCheckout = async function mtgSafeCreateProductCheckout(productId, silo) {
    if (String(silo || '').toLowerCase() !== 'mtg')
      return originalCreateProductCheckout(productId, silo);
    throw new Error('MTG checkout held: atomic stock reservation and order reconciliation not certified');
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
