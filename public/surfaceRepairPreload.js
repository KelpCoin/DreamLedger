'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');

if (!global.__dreamledgerSurfaceRepairPreload) {
  const originalCreateServer = http.createServer;
  const originalJsLoader = Module._extensions['.js'];
  const ROOT = __dirname;
  const SERVER = path.join(ROOT, 'server.js');
  const WRONG_CHECKOUT = 'https://buy.stripe.com/8x28wQ0cwbn48CA3mM9oc00';
  const COMMANDER_CHECKOUT = 'https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I';
  const FILES = {
    '/digital-products': 'digital-products/index.html',
    '/digital-products/': 'digital-products/index.html',
    '/phinhaven': 'phinhaven/floor1.html',
    '/phinhaven/': 'phinhaven/floor1.html',
    '/marketplace': 'mtg.html',
    '/marketplace/': 'mtg.html'
  };
  const TYPES = {'.html':'text/html; charset=utf-8'};

  Module._extensions['.js'] = function repairedJsLoader(mod, filename) {
    if (filename === SERVER) {
      let source = fs.readFileSync(filename, 'utf8');
      source = source.split(WRONG_CHECKOUT).join(COMMANDER_CHECKOUT);
      return mod._compile(source, filename);
    }
    return originalJsLoader(mod, filename);
  };

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
      return handler(req, res);
    });
  };
  global.__dreamledgerSurfaceRepairPreload = true;
}
