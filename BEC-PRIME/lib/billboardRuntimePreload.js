'use strict';

const http = require('http');
const { Readable } = require('stream');
const billboard = require('../routes/billboard-v2');

if (!http.createServer.__dreamledgerBillboardRuntimeWrapped) {
  const originalCreateServer = http.createServer;
  const wrappedCreateServer = function(...args) {
    const originalHandler = typeof args[0] === 'function' ? args[0] : ((req, res) => {});
    args[0] = async function(req, res) {
      const requestPath = String(req.url || '').split('?')[0];
      try {
        if (requestPath.startsWith('/api/billboard/') || requestPath === '/api/billboard') {
          const handled = await billboard.handle(req, res, requestPath);
          if (handled) return;
        }
      } catch (err) {
        if (!res.writableEnded) {
          res.writeHead(err.statusCode || 500, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
          res.end(JSON.stringify({error: err.message || 'Billboard route failed'}));
        }
        return;
      }
      return originalHandler(req, res);
    };
    return originalCreateServer.apply(this, args);
  };
  wrappedCreateServer.__dreamledgerBillboardRuntimeWrapped = true;
  http.createServer = wrappedCreateServer;
}

module.exports = {};
