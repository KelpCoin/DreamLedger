'use strict';

// Minimal UCP adapter for DreamLedger. UCP is an interoperability surface,
// not a second source of commercial truth. Prices, eligibility and approval
// remain authoritative in catalog/offers/offers.json and catalog/products.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSION = process.env.UCP_VERSION || '2026-01-11';
const BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const ROOT = __dirname;
const OFFER_CATALOG = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const PRODUCT_CATALOG = path.join(ROOT, 'catalog', 'products');
const sessions = new Map();

const CAP_CHECKOUT = {
  name: 'dev.ucp.shopping.checkout',
  version: VERSION,
  spec: `https://ucp.dev/${VERSION}/specification/checkout`,
  schema: `https://ucp.dev/${VERSION}/schemas/shopping/checkout.json`
};

function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function offers() { return json(OFFER_CATALOG).offers || []; }
function products() {
  if (!fs.existsSync(PRODUCT_CATALOG)) return [];
  return fs.readdirSync(PRODUCT_CATALOG).filter(x => x.endsWith('.json')).map(x => json(path.join(PRODUCT_CATALOG, x)));
}
function findItem(id) {
  const offer = offers().find(x => x.offer_id === id);
  if (offer) return { kind: 'offer', id: offer.offer_id, silo: offer.silo, name: offer.name, description: offer.output, price: offer.price, currency: offer.currency, approval_required: offer.approval_required !== false, checkout_available: offer.checkout_available === true };
  const product = products().find(x => x.id === id);
  if (product) return { kind: 'product', id: product.id, silo: product.silo, name: product.name, description: product.description, price: Number(product.price) / 100, currency: product.currency, approval_required: Boolean(product.commercial_truth?.approval_required), checkout_available: product.status === 'published' && !product.commercial_truth?.approval_required && Number(product.inventory) > 0 };
  return null;
}
function profile() {
  return {
    ucp: {
      version: VERSION,
      services: {
        'dev.ucp.shopping': {
          version: VERSION,
          spec: `https://ucp.dev/${VERSION}/specification/overview`,
          rest: {
            schema: `https://ucp.dev/${VERSION}/services/shopping/openapi.json`,
            endpoint: `${BASE}/ucp/v1`
          }
        }
      },
      capabilities: [CAP_CHECKOUT]
    }
  };
}
function responseMeta() { return { version: VERSION, capabilities: [CAP_CHECKOUT] }; }
function totals(item) {
  const minor = Math.round(Number(item.price) * 100);
  return [{ type: 'subtotal', amount: minor }, { type: 'total', amount: minor }];
}
function links() {
  return [
    { type: 'privacy_policy', url: `${BASE}/privacy` },
    { type: 'terms_of_service', url: `${BASE}/terms` }
  ];
}
function checkoutResponse(session) {
  return {
    ucp: responseMeta(),
    id: session.id,
    line_items: session.line_items,
    status: session.status,
    currency: session.currency,
    totals: session.totals,
    messages: session.messages || [],
    links: links(),
    expires_at: session.expires_at,
    continue_url: session.continue_url,
    payment: { handlers: [] }
  };
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 1000000) req.destroy(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function send(res, status, value) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
function requestProfile(req) {
  const header = req.headers['ucp-agent'];
  return header ? String(header) : null;
}

async function handle(req, res) {
  const url = String(req.url || '').split('?')[0];
  if (req.method === 'GET' && url === '/.well-known/ucp') {
    return send(res, 200, profile());
  }
  if (!url.startsWith('/ucp/v1/')) return false;

  if (!requestProfile(req) && req.method !== 'OPTIONS') {
    return send(res, 400, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'missing_ucp_agent', severity: 'unrecoverable', content: 'UCP-Agent profile is required.' }] });
  }

  if (req.method === 'POST' && url === '/ucp/v1/checkout-sessions') {
    let input;
    try { input = await body(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
    const line = Array.isArray(input.line_items) ? input.line_items[0] : null;
    const itemId = line?.item_id || line?.product_id || line?.offer_id || line?.id;
    const item = itemId ? findItem(itemId) : null;
    if (!item) return send(res, 404, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'item_not_found', severity: 'unrecoverable', content: 'Requested item was not found.' }] });
    if (input.currency && String(input.currency).toUpperCase() !== String(item.currency).toUpperCase()) return send(res, 422, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'currency_mismatch', severity: 'unrecoverable', content: 'Requested currency does not match merchant truth.' }] });
    const id = `ucp_${crypto.randomUUID()}`;
    const now = Date.now();
    const session = {
      id,
      status: item.checkout_available ? 'ready_for_complete' : 'requires_escalation',
      currency: String(item.currency).toUpperCase(),
      line_items: [{ id: item.id, quantity: 1, title: item.name, price: Math.round(item.price * 100) }],
      totals: totals(item),
      expires_at: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
      continue_url: `${BASE}/?ucp_checkout=${encodeURIComponent(id)}`,
      messages: item.checkout_available ? [] : [{ type: 'error', code: 'approval_required', severity: 'requires_buyer_input', content: 'This offer is not activated for checkout.' }],
      item
    };
    sessions.set(id, session);
    return send(res, 201, checkoutResponse(session));
  }

  const match = url.match(/^\/ucp\/v1\/checkout-sessions\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const session = sessions.get(id);
    if (!session) return send(res, 404, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'checkout_not_found', severity: 'unrecoverable', content: 'Checkout session not found.' }] });
    if (req.method === 'GET') return send(res, 200, checkoutResponse(session));
    if (req.method === 'PATCH') {
      if (session.status === 'completed' || session.status === 'canceled') return send(res, 409, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'checkout_not_modifiable', severity: 'unrecoverable', content: 'Checkout is no longer modifiable.' }] });
      return send(res, 200, checkoutResponse(session));
    }
    if (req.method === 'DELETE') {
      session.status = 'canceled';
      return send(res, 200, checkoutResponse(session));
    }
  }

  const complete = url.match(/^\/ucp\/v1\/checkout-sessions\/([^/]+)\/complete$/);
  if (req.method === 'POST' && complete) {
    const id = decodeURIComponent(complete[1]);
    const session = sessions.get(id);
    if (!session) return send(res, 404, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'checkout_not_found', severity: 'unrecoverable', content: 'Checkout session not found.' }] });
    if (session.status !== 'ready_for_complete') return send(res, 409, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'requires_buyer_review', severity: 'requires_buyer_input', content: 'Checkout requires the merchant checkout UI.' }], continue_url: session.continue_url });
    session.status = 'requires_escalation';
    session.messages = [{ type: 'info', code: 'merchant_checkout_required', severity: 'requires_buyer_input', content: 'Payment must be completed through the merchant checkout surface.' }];
    return send(res, 200, checkoutResponse(session));
  }

  return send(res, 404, { ucp: { version: VERSION }, messages: [{ type: 'error', code: 'not_found', severity: 'unrecoverable', content: 'UCP endpoint not found.' }] });
}

module.exports = { handle, profile, VERSION };
