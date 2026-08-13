'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'marketplace', 'catalog', 'sku-seeds.json');
const pagePath = path.join(__dirname, '..', 'marketplace', 'marketplace.html');

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function catalog() {
  try {
    const parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (_) {
    return [];
  }
}

function route(req, res) {
  const requestPath = String(req.url || '').split('?')[0];
  if (req.method === 'GET' && requestPath === '/marketplace') {
    try { return send(res, 200, fs.readFileSync(pagePath, 'utf8'), 'text/html; charset=utf-8'); }
    catch (_) { return send(res, 503, { error: 'Marketplace surface unavailable' }); }
  }
  if (req.method === 'GET' && requestPath === '/api/marketplace/catalog') {
    return send(res, 200, { schema: 'bec-prime.marketplace.v1', items: catalog() });
  }
  return false;
}

const realCreateServer = http.createServer;
const baseCreateServer = function wrappedCreateServer(options, handler) {
  if (typeof options === 'function') {
    handler = options;
    options = undefined;
  }
  const wrapped = function(req, res) {
    if (route(req, res)) return;
    return handler(req, res);
  };
  return realCreateServer.call(http, options, wrapped);
};

Object.defineProperty(http, 'createServer', {
  configurable: true,
  enumerable: true,
  get: function() { return baseCreateServer; },
  set: function(_) { /* start.js may install its compatibility wrapper; keep our outer gate */ }
});
