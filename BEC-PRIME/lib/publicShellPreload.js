'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'compiled', 'website');
const original = http.createServer;
function htmlFile(route) {
  const map = { '/': 'index.html', '/dreamiez': 'dreamiez.html', '/mtg': path.join('mtg', 'index.html'), '/commander': path.join('commander', 'index.html') };
  return map[route] || null;
}
function shell(file) {
  const full = path.join(PUBLIC, file);
  if (!fs.existsSync(full)) return null;
  let html = fs.readFileSync(full, 'utf8');
  if (!html.includes('/assets/dreamiez-account.js')) html = html.replace('</body>', '<script src="/assets/dreamiez-account.js" defer></script><script src="/assets/digital-proxy-assist.js" defer></script></body>');
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
    return handler(req, res);
  };
  return original.apply(this, args);
};
