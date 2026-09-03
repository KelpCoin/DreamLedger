'use strict';

/* Keep Stripe webhook handling on the persistent DreamLedger engine.
 * The public storefront has no durable disk and must not consume /webhook itself.
 */
const http = require('http');
const { URL } = require('url');

if (!global.__dreamledgerWebhookProxyPreload) {
  const originalCreateServer = http.createServer;
  http.createServer = function wrappedCreateServer(handler) {
    const engine = String(process.env.ENGINE_INTERNAL_URL || '');
    const wrapped = async function webhookProxyHandler(req, res) {
      if (req.method === 'POST' && String(req.url || '').split('?')[0] === '/webhook' && engine) {
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
          const upstream = http.request({
            hostname: target.hostname,
            port: Number(target.port || 80),
            path: '/webhook',
            method: 'POST',
            headers
          }, response => {
            res.statusCode = response.statusCode || 502;
            for (const [key, value] of Object.entries(response.headers)) {
              if (key !== 'connection' && key !== 'transfer-encoding' && value !== undefined) res.setHeader(key, value);
            }
            response.pipe(res);
          });
          upstream.setTimeout(20000, () => upstream.destroy());
          upstream.on('error', err => {
            if (!res.writableEnded) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: err.message || 'Webhook upstream unavailable' }));
            }
          });
          upstream.end(body);
          return;
        } catch (err) {
          if (!res.writableEnded) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err.message || 'Webhook proxy failed' }));
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
