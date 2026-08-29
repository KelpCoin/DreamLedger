'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 10000);
const ENGINE = process.env.ENGINE_INTERNAL_URL;
const ENGINE_KEY = process.env.ENGINE_INTERNAL_API_KEY;
const ROOT = __dirname;

const PUBLIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/billboard': 'billboard.html',
  '/billboard/': 'billboard.html',
  '/robots.txt': 'robots.txt'
};

const API_PREFIXES = [
  '/api/products',
  '/api/offers',
  '/api/offer-checkout/create',
  '/api/billboard'
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function headers(res) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://buy.stripe.com");
}

function send(res, status, body, type) {
  if (res.writableEnded) return;
  res.statusCode = status;
  if (type) res.setHeader('Content-Type', type);
  res.end(body);
}

function isAllowedApi(p) {
  return API_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + '/'));
}

function proxy(req, res, body) {
  if (!ENGINE || !ENGINE_KEY) return send(res, 503, 'Service unavailable', 'text/plain; charset=utf-8');
  const target = new URL('http://' + ENGINE);
  const options = {
    hostname: target.hostname,
    port: Number(target.port || 80),
    path: req.url,
    method: req.method,
    headers: {
      'x-dreamledger-internal-key': ENGINE_KEY,
      'content-type': req.headers['content-type'] || 'application/octet-stream',
      'content-length': Buffer.byteLength(body),
      'stripe-signature': req.headers['stripe-signature'] || ''
    }
  };
  const upstream = http.request(options, r => {
    res.statusCode = r.statusCode || 502;
    for (const [k, v] of Object.entries(r.headers)) {
      if (k === 'connection' || k === 'transfer-encoding') continue;
      if (v !== undefined) res.setHeader(k, v);
    }
    r.pipe(res);
  });
  upstream.setTimeout(20000, () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', () => send(res, 502, 'Service unavailable', 'text/plain; charset=utf-8'));
  upstream.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 6000000) {
        reject(new Error('request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  headers(res);
  const u = new URL(req.url || '/', 'http://localhost');
  const p = u.pathname;

  if (req.method === 'GET' && p === '/healthz') {
    return send(res, 200, 'ok', 'text/plain; charset=utf-8');
  }

  if (req.method === 'GET' && p === '/go') {
    res.statusCode = 302;
    res.setHeader('Location', '/billboard');
    return res.end();
  }

  if (p === '/webhook' && req.method === 'POST') {
    try { return proxy(req, res, (await readBody(req)).toString('utf8')); }
    catch { return send(res, 400, 'Bad request', 'text/plain; charset=utf-8'); }
  }

  if (p === '/webhook') return send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');

  if (p.startsWith('/api/')) {
    if (!isAllowedApi(p)) return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
    try { return proxy(req, res, (await readBody(req)).toString('utf8')); }
    catch { return send(res, 400, 'Bad request', 'text/plain; charset=utf-8'); }
  }

  const file = PUBLIC_FILES[p];
  if (!file || req.method !== 'GET') return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  const full = path.join(ROOT, file);
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
    res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    send(res, 200, data);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('DreamLedger public storefront listening on ' + PORT));
