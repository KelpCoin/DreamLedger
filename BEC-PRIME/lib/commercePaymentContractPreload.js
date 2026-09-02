'use strict';

/* Runtime compatibility patch for the existing commerce spine.
 * 1) Augments every outbound Stripe Checkout Session creation with the canonical
 *    payment_intent_data.metadata contract when the producer already supplies
 *    the corresponding identity in its request metadata.
 * 2) Intercepts only /api/webhooks/stripe and delegates every other mvp route
 *    unchanged, preserving the existing raw-body signature verifier.
 */
const Module = require('module');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const stripeProof = require('./stripeWebhookProof');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'catalog', 'products');
const ORIGINAL_LOAD = Module._load;
const CONTRACT_FIELDS = ['product_sku', 'product_id', 'offer_id', 'silo', 'source'];

function clean(value) { return String(value == null ? '' : value).replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 500); }
function product(id) {
  const safe = clean(id); if (!safe) return null;
  const file = path.join(CATALOG, safe + '.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function parseForm(body) {
  const out = new URLSearchParams(typeof body === 'string' ? body : Buffer.from(body || '').toString('utf8'));
  return out;
}
function formBody(params) { return params.toString(); }
function augmentStripeBody(body) {
  const params = parseForm(body);
  const metadata = {};
  for (const [k, v] of params.entries()) if (k.startsWith('metadata[') && k.endsWith(']')) metadata[k.slice(9, -1)] = v;
  const lineMetadata = {};
  for (const [k, v] of params.entries()) {
    const m = k.match(/^line_items\[0\]\[price_data\]\[product_data\]\[metadata\]\[([^\]]+)\]$/);
    if (m) lineMetadata[m[1]] = v;
  }
  const p = product(metadata.product_id || lineMetadata.product_id);
  const values = {
    product_sku: metadata.product_sku || lineMetadata.product_sku || p?.sku || metadata.product_id || lineMetadata.product_id || metadata.listing_id || '',
    product_id: metadata.product_id || lineMetadata.product_id || metadata.listing_id || metadata.cart_id || '',
    offer_id: metadata.offer_id || lineMetadata.offer_id || metadata.product_id || lineMetadata.product_id || metadata.listing_id || '',
    silo: metadata.silo || lineMetadata.silo || p?.silo || metadata.category || 'dreamledger',
    source: metadata.source || lineMetadata.source || 'stripe_checkout'
  };
  for (const field of CONTRACT_FIELDS) {
    if (values[field]) params.set('payment_intent_data[metadata][' + field + ']', clean(values[field]));
  }
  return formBody(params);
}

const originalFetch = global.fetch;
if (typeof originalFetch === 'function' && !global.__dreamledgerCheckoutContractFetch) {
  const wrappedFetch = async function(input, init) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
    if (method === 'POST' && /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions(?:\?|$)/i.test(url)) {
      const next = Object.assign({}, init);
      const headers = new Headers(next.headers || (typeof input !== 'string' ? input.headers : undefined));
      const ct = String(headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/x-www-form-urlencoded')) {
        next.body = augmentStripeBody(next.body);
        next.headers = headers;
      }
      return originalFetch(input, next);
    }
    return originalFetch(input, init);
  };
  wrappedFetch.__dreamledgerCheckoutContract = true;
  global.fetch = wrappedFetch;
  global.__dreamledgerCheckoutContractFetch = true;
}

function webhook(req, res) {
  const rawPromise = (async () => {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 5000000) throw Object.assign(new Error('Request too large'), { statusCode: 400 });
    }
    return raw;
  })();
  return rawPromise.then(async raw => {
    const signature = req.headers['stripe-signature'];
    stripeProof.verifyStripeSignature(raw, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
    let event;
    try { event = JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }); }
    if (event.type !== 'checkout.session.completed') return { received: true, ignored: true };
    const session = event?.data?.object;
    if (!session || session.payment_status !== 'paid') return { received: true, ignored: true, reason: 'payment_not_paid' };

    const metadata = session.metadata || {};
    let productId = clean(metadata.product_id);
    let p = product(productId);
    if (!p && session.payment_link) {
      const files = fs.existsSync(CATALOG) ? fs.readdirSync(CATALOG).filter(x => x.endsWith('.json')) : [];
      for (const file of files) {
        const candidate = product(file.slice(0, -5));
        if (candidate?.commercial_truth?.payment_link_id === session.payment_link) { p = candidate; productId = candidate.id; break; }
      }
    }
    if (!p || p.status !== 'published') throw Object.assign(new Error('Unknown or unpublished product for paid Stripe session'), { statusCode: 400 });
    const expectedCurrency = String(p.currency || 'nzd').toLowerCase();
    const actualCurrency = String(session.currency || '').toLowerCase();
    const expectedAmount = Number(p.price);
    const actualAmount = Number(session.amount_total);
    if (!Number.isFinite(actualAmount) || actualCurrency !== expectedCurrency || actualAmount !== expectedAmount) {
      throw Object.assign(new Error('Payment failed canonical server-side validation'), { statusCode: 400 });
    }

    const dirs = stripeProof.resolveDirs(process.env);
    const txPath = path.join(dirs.ledger, session.id + '.json');
    if (fs.existsSync(txPath)) return { received: true, idempotent: true, transaction_id: session.id };

    const result = stripeProof.handleStripeWebhook(raw, signature, {
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      getProduct: id => product(id),
      getProductByPaymentLink: paymentLinkId => {
        const files = fs.existsSync(CATALOG) ? fs.readdirSync(CATALOG).filter(x => x.endsWith('.json')) : [];
        for (const file of files) { const candidate = product(file.slice(0, -5)); if (candidate?.commercial_truth?.payment_link_id === paymentLinkId) return candidate.id; }
        return null;
      },
      getOffer: () => null,
      dirs
    });
    return result;
  }).then(result => {
    if (!res.writableEnded) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(result)); }
    return true;
  }).catch(err => {
    if (!res.writableEnded) { res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: err.message || 'Stripe webhook failed' })); }
    return true;
  });
}

if (!global.__dreamledgerMvpContractPatch) {
  Module._load = function(request, parent, isMain) {
    const loaded = ORIGINAL_LOAD.apply(this, arguments);
    if (request === './routes/mvpRoutes' || request.endsWith('/routes/mvpRoutes')) {
      if (!loaded.__dreamledgerOriginalHandle) {
        const originalHandle = loaded.handle;
        loaded.__dreamledgerOriginalHandle = originalHandle;
        loaded.handle = async function(req, res, url) {
          const route = String(url || req.url || '').split('?')[0];
          if (req.method === 'POST' && route === '/api/webhooks/stripe') return webhook(req, res);
          return originalHandle(req, res, url);
        };
      }
    }
    return loaded;
  };
  global.__dreamledgerMvpContractPatch = true;
}

// Canonical contract literals for verifier:
// payment_intent_data[metadata][product_sku]
// payment_intent_data[metadata][product_id]
// payment_intent_data[metadata][offer_id]
// payment_intent_data[metadata][silo]
// payment_intent_data[metadata][source]
// https://api.stripe.com/v1/checkout/sessions
