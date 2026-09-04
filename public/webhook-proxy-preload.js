'use strict';

/* Truth Oracle HTML is served from the compiled engine surface; its APIs and webhook remain engine-backed. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

if (!global.__dreamledgerWebhookProxyPreload) {
  const originalCreateServer = http.createServer;
  http.createServer = function wrappedCreateServer(handler) {
    const wrapped = async function webhookProxyHandler(req, res) {
      const requestPath = String(req.url || '').split('?')[0];
      if (req.method === 'GET' && (requestPath === '/truth-oracle' || requestPath === '/truth-oracle/')) {
        const file = path.join(__dirname, '..', 'BEC-PRIME', 'compiled', 'website', 'truth-oracle.html');
        try {
          const body = fs.readFileSync(file);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        } catch {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Truth Oracle surface unavailable');
        }
        return;
      }

      /* Canonical public offers use stable offer IDs while the legacy storefront handler still keys on product IDs. */
      if (req.method === 'POST' && requestPath === '/api/offer-checkout/create') {
        let body = Buffer.alloc(0);
        try {
          for await (const chunk of req) {
            body = Buffer.concat([body, Buffer.from(chunk)]);
            if (body.length > 100000) throw new Error('Request too large');
          }
          const payload = JSON.parse(body.toString('utf8'));
          if (payload && payload.offer_id === 'OFFER-CMD-DIAG-29-NZD') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({
              ok: true,
              offer_id: 'OFFER-CMD-DIAG-29-NZD',
              product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
              amount_nzd: 29,
              currency: 'NZD',
              checkout_url: 'https://buy.stripe.com/8x28wQ0cwbn48CA3mM9oc00'
            }));
            return;
          }
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Invalid checkout request' }));
          return;
        }
        return handler(req, res);
      }

      const engine = String(process.env.ENGINE_INTERNAL_URL || '');
      const engineKey = String(process.env.ENGINE_INTERNAL_API_KEY || '');
      const isWebhook = req.method === 'POST' && requestPath === '/webhook';
      const isTruthOracleApi = requestPath === '/api/truth-oracle' || requestPath.startsWith('/api/truth-oracle/');
      const needsEngine = isWebhook || isTruthOracleApi;
      if (!needsEngine) return handler(req, res);

      if (!engine) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ error: 'DreamLedger engine wiring unavailable', code: 'ENGINE_INTERNAL_URL_MISSING' }));
        return;
      }

      let body = Buffer.alloc(0);
      try {
        for await (const chunk of req) {
          body = Buffer.concat([body, Buffer.from(chunk)]);
          if (body.length > 5000000) throw new Error('Request too large');
        }
        const target = new URL('http://' + engine);
        const headers = {
          'content-type': req.headers['content-type'] || 'application/json',
          'content-length': body.length,
          'stripe-signature': req.headers['stripe-signature'] || ''
        };
        if (engineKey) headers['x-dreamledger-internal-key'] = engineKey;
        if (req.headers.cookie) headers.cookie = req.headers.cookie;
        const upstream = http.request({hostname: target.hostname, port: Number(target.port || 80), path: req.url, method: req.method, headers}, response => {
          res.statusCode = response.statusCode || 502;
          for (const [key, value] of Object.entries(response.headers)) {
            if (key !== 'connection' && key !== 'transfer-encoding' && value !== undefined) res.setHeader(key, value);
          }
          res.setHeader('Cache-Control', 'no-store');
          response.pipe(res);
        });
        upstream.setTimeout(20000, () => upstream.destroy());
        upstream.on('error', err => {
          if (!res.writableEnded) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ error: err.message || 'Engine upstream unavailable', code: 'ENGINE_UPSTREAM_UNAVAILABLE' }));
          }
        });
        upstream.end(body);
      } catch (err) {
        if (!res.writableEnded) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message || 'Engine proxy failed', code: 'ENGINE_PROXY_FAILED' }));
        }
      }
    };
    return originalCreateServer.call(this, wrapped);
  };
  global.__dreamledgerWebhookProxyPreload = true;
}
