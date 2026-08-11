'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const dreamiezAccount = require('./dreamiez-account');
const controlPlane = require('./runtime/ControlPlane');
const demandRadar = require('./runtime/DemandRadar');
const sentinel = require('./runtime/Sentinel');
const digitalProxyAssistant = require('./proxy/DigitalProxyAssistant');

const originalCreateServer = http.createServer;
let capturedServer = null;
const PRODUCT_CATALOG = path.join(__dirname, 'catalog', 'products');
const OFFER_CATALOG = path.join(__dirname, 'catalog', 'offers', 'offers.json');
const PORT = Number(process.env.PORT || 3000);

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 200000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function loadApprovedProducts() {
  if (!fs.existsSync(PRODUCT_CATALOG)) return [];
  return fs.readdirSync(PRODUCT_CATALOG)
    .filter(name => name.endsWith('.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(PRODUCT_CATALOG, name), 'utf8')))
    .filter(product => product.status === 'published' && product.commercial_truth && product.commercial_truth.approval_required === false);
}

function loadCompiledOffers() {
  if (!fs.existsSync(OFFER_CATALOG)) return [];
  const catalog = JSON.parse(fs.readFileSync(OFFER_CATALOG, 'utf8'));
  return Array.isArray(catalog.offers) ? catalog.offers : [];
}

function productAsOffer(product) {
  const sold = Number(product.inventory || 0) < 1;
  return {
    offer_id: product.id,
    version: 'offer-v1',
    capability_id: `PRODUCT-${product.id}`,
    silo: product.silo,
    name: product.name,
    problem: 'Purchase the published physical product.',
    input: 'No additional input required to purchase.',
    output: product.description,
    target_buyer: 'Buyer seeking the published product.',
    offer_type: 'product',
    delivery_method: 'physical_delivery',
    price: Number(product.price) / 100,
    currency: 'NZD',
    pricing_mode: 'fixed',
    pricing_tier: null,
    eligibility: 'Available while inventory remains.',
    proof_of_delivery: 'stripe_payment_plus_durable_transaction_proof',
    refund_policy: 'Apply the published checkout policy.',
    approval_required: false,
    checkout_available: !sold,
    checkout_route: '/api/offer-checkout/create',
    status: sold ? 'sold' : 'published',
    verification_rules: ['canonical_product', 'explicit_operator_approval', 'inventory_positive', 'stripe_checkout', 'webhook_proof'],
    private_material_excluded: true
  };
}

function approvedProductOffer(id) {
  const product = loadApprovedProducts().find(item => item.id === id);
  return product ? productAsOffer(product) : null;
}

function replayRequest(req, payload) {
  const replay = Readable.from([payload]);
  replay.method = req.method;
  replay.url = req.url;
  replay.headers = req.headers;
  replay.httpVersion = req.httpVersion;
  replay.socket = req.socket;
  return replay;
}

http.createServer = function wrappedCreateServer(...args) {
  const originalHandler = args[0];
  args[0] = async function dreamledgerRuntimeHandler(req, res) {
    const requestPath = String(req.url || '').split('?')[0];
    demandRadar.record('route', { route: requestPath, source: 'runtime' });

    if (req.method === 'GET' && requestPath === '/api/offers') {
      try {
        const compiled = loadCompiledOffers();
        const products = loadApprovedProducts().map(productAsOffer);
        return send(res, 200, { offers: [...compiled, ...products] });
      } catch (err) {
        console.error('Offer surface failed:', err);
        return send(res, 500, { error: err.message || 'Offer surface failed' });
      }
    }

    if (req.method === 'GET' && requestPath.startsWith('/api/offers/')) {
      const offerId = requestPath.slice('/api/offers/'.length);
      const productOffer = approvedProductOffer(offerId);
      if (productOffer) return send(res, 200, productOffer);
    }

    if (req.method === 'POST' && requestPath === '/api/offer-checkout/create') {
      try {
        const body = await jsonBody(req);
        const productOffer = approvedProductOffer(body.offer_id);
        if (productOffer) {
          const payload = JSON.stringify({ product_id: productOffer.offer_id, silo: productOffer.silo });
          return proxyProductCheckout(res, productOffer.offer_id, productOffer.silo, payload);
        }
        return originalHandler(replayRequest(req, JSON.stringify(body)), res);
      } catch (err) {
        return send(res, 400, { error: err.message || 'Invalid JSON' });
      }
    }

    if (req.method === 'POST' && requestPath === '/api/digital-proxy/help') {
      try {
        const body = await jsonBody(req);
        demandRadar.record('help_request', { route: requestPath, source: 'digital-proxy' });
        const result = await digitalProxyAssistant.reply(body.message, { route: body.route || requestPath });
        return send(res, 200, result);
      } catch (err) {
        return send(res, 400, { error: err.message || 'Help request failed' });
      }
    }

    if (req.method === 'GET' && requestPath === '/api/control/demand') {
      return send(res, 200, { summary: demandRadar.summary(), proposal: demandRadar.proposal() });
    }

    if (req.method === 'POST' && requestPath === '/api/control/demand/record') {
      try {
        const body = await jsonBody(req);
        return send(res, 201, demandRadar.record(body.type || 'manual_signal', body));
      } catch (err) {
        return send(res, 400, { error: err.message || 'Invalid demand signal' });
      }
    }

    if (req.method === 'GET' && requestPath === '/api/control/sentinel') {
      return send(res, 200, sentinel.run(controlPlane.health().boot.gauntlet));
    }

    if (await dreamiezAccount.handle(req, res)) return;
    if (await controlPlane.handle(req, res)) return;

    if (req.method === 'GET' && requestPath === '/') {
      const originalEnd = res.end;
      res.end = function injectedEnd(chunk, encoding, callback) {
        try {
          const contentType = String(res.getHeader('Content-Type') || '');
          if (chunk && contentType.includes('text/html')) {
            let html = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
            html = html.replace('</body>', '<script src="/assets/dreamiez-account.js"></script><script src="/assets/digital-proxy-assist.js"></script></body>');
            return originalEnd.call(this, html, 'utf8', callback);
          }
        } catch (err) {
          console.error('DreamLedger UI injection failed:', err.message);
        }
        return originalEnd.call(this, chunk, encoding, callback);
      };
    }
    return originalHandler(req, res);
  };
  capturedServer = originalCreateServer.apply(this, args);
  return capturedServer;
};

function proxyProductCheckout(res, productId, silo, payload) {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/checkout/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, upstreamRes => {
    let data = '';
    upstreamRes.setEncoding('utf8');
    upstreamRes.on('data', chunk => { data += chunk; });
    upstreamRes.on('end', () => {
      let body;
      try { body = JSON.parse(data || '{}'); } catch { body = { error: data }; }
      send(res, upstreamRes.statusCode || 502, { ...body, offer_id: productId });
    });
  });
  upstream.on('error', err => send(res, 502, { error: err.message }));
  upstream.end(payload);
}

const boot = controlPlane.boot();
const sentinelResult = sentinel.run(boot.gauntlet);
console.log(JSON.stringify({ control_plane_boot: boot, sentinel: sentinelResult }, null, 2));
if (boot.status !== 'PASS' || sentinelResult.verdict !== 'PASS') {
  throw new Error('Enterprise boot gate failed; refusing to start runtime');
}

require('./server.js');

if (!capturedServer) throw new Error('BEC-PRIME server did not create an HTTP server');

if (!capturedServer.listening) {
  capturedServer.listen(PORT, '0.0.0.0', () => {
    console.log(`DreamLedger commerce runtime listening on 0.0.0.0:${PORT}`);
  });
}
