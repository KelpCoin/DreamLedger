'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const PUBLIC_ROOT = path.join(__dirname, '..', 'compiled', 'website');
const originalCreateServer = http.createServer;
const ACCOUNT_PAGES = new Set(['/login.html', '/register.html', '/account.html']);

function serveAccountPage(req, res) {
  const route = String(req.url || '').split('?')[0];
  if (req.method !== 'GET' || !ACCOUNT_PAGES.has(route)) return false;

  const file = path.join(PUBLIC_ROOT, route.slice(1));
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({ error: 'Account page not found' }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(data.length)
    });
    res.end(data);
  });
  return true;
}

http.createServer = function accountPageCreateServer(...args) {
  const handler = typeof args[0] === 'function' ? args[0] : () => {};
  args[0] = function accountPageHandler(req, res) {
    if (serveAccountPage(req, res)) return;
    return handler(req, res);
  };
  return originalCreateServer.apply(this, args);
};
