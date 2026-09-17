'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

if (!global.__dreamledgerSurfaceRepairPreload) {
  const originalCreateServer = http.createServer;
  const ROOT = __dirname;
  const COMMANDER_CHECKOUT = 'https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l';
  const FILES = {
    '/digital-products': 'digital-products/index.html',
    '/digital-products/': 'digital-products/index.html',
    '/phinhaven': 'phinhaven/floor1.html',
    '/phinhaven/': 'phinhaven/floor1.html',
    '/marketplace': 'mtg.html',
    '/marketplace/': 'mtg.html'
  };
  const TYPES = {'.html':'text/html; charset=utf-8'};

  function serve(res, relative) {
    const file = path.join(ROOT, relative);
    if (!fs.existsSync(file)) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(fs.readFileSync(file));
  }

  http.createServer = function wrappedCreateServer(handler) {
    return originalCreateServer.call(this, async function surfaceRepairHandler(req, res) {
      const route = String(req.url || '').split('?')[0];
      if (req.method === 'GET' && FILES[route]) {
        serve(res, FILES[route]);
        return;
      }
      if (req.method === 'POST' && route === '/api/offer-checkout/create') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            if (body.offer_id === 'COMMANDER-DECK-DIAGNOSTIC-001') {
              res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
              res.end(JSON.stringify({ok:true,offer_id:body.offer_id,checkout_url:COMMANDER_CHECKOUT}));
              return;
            }
            handler(req, res);
          } catch (err) {
            res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'});
            res.end(JSON.stringify({error:err.message || 'Invalid JSON'}));
          }
        });
        return;
      }
      return handler(req, res);
    });
  };
  global.__dreamledgerSurfaceRepairPreload = true;
}
