'use strict';

const http = require('http');
const crypto = require('crypto');
const originalCreateServer = http.createServer;
const expected = String(process.env.ENGINE_INTERNAL_API_KEY || '');

if (!expected) {
  throw new Error('ENGINE_INTERNAL_API_KEY is required for private engine runtime');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

http.createServer = function boundaryCreateServer(...args) {
  const originalHandler = typeof args[0] === 'function' ? args[0] : null;
  if (!originalHandler) return originalCreateServer.apply(this, args);

  args[0] = function boundaryGuard(req, res) {
    const requestPath = String(req.url || '').split('?')[0];
    if (req.method === 'GET' && requestPath === '/healthz') {
      return originalHandler(req, res);
    }
    const supplied = req.headers['x-dreamledger-internal-key'];
    if (!safeEqual(supplied || '', expected)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Not Found');
    }
    return originalHandler(req, res);
  };
  return originalCreateServer.apply(this, args);
};
