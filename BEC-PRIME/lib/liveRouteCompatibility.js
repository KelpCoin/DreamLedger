'use strict';

// Production route compatibility layer.
// The canonical runtime is start.js, but legacy deployment probes and older
// clients may still call the historical API paths. Keep them mapped to the
// same live commerce handlers without duplicating checkout logic.
const http = require('http');
const originalCreateServer = http.createServer;

http.createServer = function liveRouteCompatibilityCreateServer(...args) {
  const originalHandler = args[0];
  if (typeof originalHandler !== 'function') return originalCreateServer.apply(this, args);

  args[0] = async function liveRouteCompatibilityHandler(req, res) {
    const originalUrl = req.url;
    const requestPath = String(originalUrl || '').split('?')[0];

    // Keep both health probe conventions alive.
    if (req.method === 'GET' && requestPath === '/api/healthz') {
      req.url = '/healthz';
      try { return await originalHandler(req, res); }
      finally { req.url = originalUrl; }
    }

    // Product checkout alias: the canonical runtime exposes
    // /api/offer-checkout/create for offer/product checkout.
    if (req.method === 'POST' && requestPath === '/api/checkout/create') {
      req.url = '/api/offer-checkout/create';
      try { return await originalHandler(req, res); }
      finally { req.url = originalUrl; }
    }

    // Historical omni checkout alias. The platform-cart handler is the
    // canonical implementation for cart settlement.
    if (req.method === 'POST' && requestPath === '/api/omni/checkout') {
      req.url = '/api/cart/checkout';
      try { return await originalHandler(req, res); }
      finally { req.url = originalUrl; }
    }

    return originalHandler(req, res);
  };

  return originalCreateServer.apply(this, args);
};
