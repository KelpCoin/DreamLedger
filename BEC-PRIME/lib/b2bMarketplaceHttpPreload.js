'use strict';

const http = require('http');
const kernel = require('./b2bMarketplaceKernelPreload');

const previousCreateServer = http.createServer;

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function handle(req, res) {
  const path = String(req.url || '').split('?')[0];
  if (req.method === 'GET' && path === '/api/marketplace/catalog') {
    const items = await kernel.getListings();
    return send(res, 200, { schema: 'dreamledger.b2b-marketplace.v1', items });
  }
  if (req.method === 'GET' && path === '/api/marketplace/listings') {
    const items = await kernel.getListings();
    const query = new URL(req.url, 'http://dreamledger.local').searchParams;
    const q = String(query.get('q') || '').toLowerCase();
    const category = String(query.get('category') || '').toLowerCase();
    const min = Number(query.get('min') || 0);
    const max = Number(query.get('max') || Number.MAX_SAFE_INTEGER);
    const filtered = items.filter(item => (!q || (item.title + ' ' + item.description).toLowerCase().includes(q)) && (!category || String(item.category).toLowerCase() === category) && item.price >= min && item.price <= max);
    return send(res, 200, { items: filtered });
  }
  const detail = path.match(/^\/api\/marketplace\/listings\/([^/]+)$/);
  if (req.method === 'GET' && detail) {
    const item = await kernel.getListing(detail[1]);
    if (!item) return send(res, 404, { error: 'listing not found' });
    return send(res, 200, { item });
  }
  const checkout = path.match(/^\/api\/marketplace\/listings\/([^/]+)\/checkout$/);
  if (req.method === 'POST' && checkout) {
    const item = await kernel.getListing(checkout[1]);
    if (!item || !item.checkout_available) return send(res, 404, { error: 'listing not available' });
    const session = await kernel.createCheckout(item);
    return send(res, 200, { ok: true, listing_id: item.id, session_id: session.id, checkout_url: session.url });
  }
  if (req.method === 'POST' && path === '/webhook') {
    const handled = await kernel.handleB2BWebhook(req, res);
    if (handled) return true;
  }
  return false;
}

http.createServer = function b2bKernelCreateServer(...args) {
  const originalHandler = typeof args[0] === 'function' ? args[0] : (() => {});
  args[0] = async function b2bKernelRuntimeHandler(req, res) {
    try {
      if (await handle(req, res)) return;
    } catch (err) {
      return send(res, err.statusCode || 500, { error: err.message || 'B2B marketplace kernel failed' });
    }
    return originalHandler(req, res);
  };
  return previousCreateServer.apply(this, args);
};
