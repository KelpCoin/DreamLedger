'use strict';

/* Keep Stripe webhook and Truth Oracle API handling on the persistent DreamLedger engine.
 * The public storefront serves the Truth Oracle HTML shell itself so the page remains reachable
 * even when the private engine is restarting. Engine-backed API and webhook traffic stays private.
 */
const http = require('http');
const { URL } = require('url');

if (!global.__dreamledgerWebhookProxyPreload) {
  const originalCreateServer = http.createServer;
  http.createServer = function wrappedCreateServer(handler) {
    const wrapped = async function webhookProxyHandler(req, res) {
      const engine = String(process.env.ENGINE_INTERNAL_URL || '');
      const engineKey = String(process.env.ENGINE_INTERNAL_API_KEY || '');
      const requestPath = String(req.url || '').split('?')[0];
      const isWebhook = req.method === 'POST' && requestPath === '/webhook';
      const isTruthOracleApi = requestPath === '/api/truth-oracle' || requestPath.startsWith('/api/truth-oracle/');
      const needsEngine = isWebhook || isTruthOracleApi;

      if (needsEngine) {
        if (!engine) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ error: 'DreamLedger engine wiring unavailable', code: 'ENGINE_INTERNAL_URL_MISSING' }));
          return;
        }

        let body = Buffer.alloc(0);
        try {
          const chunks = [];
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

          const upstream = http.request({
            hostname: target.hostname,
            port: Number(target.port || 80),
            path: req.url,
            method: req.method,
            headers
          }, response => {
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
          return;
        } catch (err) {
          if (!res.writableEnded) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err.message || 'Engine proxy failed', code: 'ENGINE_PROXY_FAILED' }));
          }
          return;
        }
      }

      return handler(req, res);
    };
    return originalCreateServer.call(this, wrapped);
  };
  global.__dreamledgerWebhookProxyPreload = true;
}
