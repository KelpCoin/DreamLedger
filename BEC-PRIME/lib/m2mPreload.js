'use strict';
const http = require('http');
const m2m = require('../routes/m2m');
const original = http.createServer;
http.createServer = function preloadedCreateServer(...args) {
  const handler = args[0];
  if (typeof handler !== 'function') return original.apply(this, args);
  args[0] = async function m2mFirst(req, res) {
    const url = String(req.url || '').split('?')[0];
    if (url.startsWith('/m2m/v1')) {
      try { if (await m2m.handle(req, res, url)) return; } catch (err) { if (!res.writableEnded) { res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: err.message || 'M2M request failed' })); } return; }
    }
    return handler(req, res);
  };
  return original.apply(this, args);
};
