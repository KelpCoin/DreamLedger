'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'compiled', 'website');
const billboard = require('../routes/billboard');
const original = http.createServer;
function htmlFile(route) {
  const map = {
    '/': 'index.html',
    '/dreamiez': 'dreamiez.html',
    '/dreammeez': 'dreamiez.html',
    '/mtg': path.join('mtg', 'index.html'),
    '/commander': path.join('commander', 'index.html'),
    '/billboard': 'billboard.html',
    '/billboard/': 'billboard.html',
    '/billboard-review': 'billboard-review.html',
    '/billboard-review/': 'billboard-review.html',
    '/cinema': 'cinema.html',
    '/cinema.html': 'cinema.html'
  };
  return map[route] || null;
}
function shell(file) {
  const full = path.join(PUBLIC, file);
  if (!fs.existsSync(full)) return null;
  let html = fs.readFileSync(full, 'utf8');
  if (!html.includes('/assets/dreamiez-account.js')) html = html.replace('</body>', '<script src="/assets/dreamiez-account.js" defer></script><script src="/assets/digital-proxy-assist.js" defer></script></body>');
  if (!html.includes('/assets/dreammee-doorway.js')) html = html.replace('</body>', '<script src="/assets/dreammee-doorway.js" defer></script></body>');
  return Buffer.from(html, 'utf8');
}
http.createServer = function publicShellCreateServer(...args) {
  const handler = args[0];
  if (typeof handler !== 'function') return original.apply(this, args);
  args[0] = async function publicShellHandler(req, res) {
    const route = String(req.url || '').split('?')[0];
    if (req.method === 'GET') {
      const file = htmlFile(route);
      if (file) {
        const payload = shell(file);
        if (payload) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': String(payload.length) });
          return res.end(payload);
        }
      }
    }
    try {
      if (await billboard.handle(req, res, route)) return;
    } catch (err) {
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: err.message || 'Billboard route failed' }));
      }
      return;
    }
    return handler(req, res);
  };
  return original.apply(this, args);
};
