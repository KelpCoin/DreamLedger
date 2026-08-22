'use strict';
const http = require('http');
const originalCreateServer = http.createServer;
const aliases = {
  '/mtg': '/mtg/index.html',
  '/mtg/': '/mtg/index.html',
  '/cinema': '/cinema.html',
  '/cinema/': '/cinema.html'
};
http.createServer = function mtgRouteCompatibleCreateServer(handler) {
  const wrapped = typeof handler === 'function'
    ? function(req, res) {
        if (req && req.method === 'GET') {
          const raw = String(req.url || '').split('?')[0];
          if (aliases[raw]) req.url = aliases[raw] + (String(req.url || '').includes('?') ? String(req.url).slice(String(req.url).indexOf('?')) : '');
        }
        return handler(req, res);
      }
    : handler;
  return originalCreateServer.call(this, wrapped);
};
