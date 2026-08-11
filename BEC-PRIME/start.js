'use strict';

const http = require('http');
const fs = require('fs');
const dreamiezAccount = require('./dreamiez-account');
const controlPlane = require('./runtime/ControlPlane');
const demandRadar = require('./runtime/DemandRadar');
const sentinel = require('./runtime/Sentinel');
const digitalProxyAssistant = require('./proxy/DigitalProxyAssistant');
const entitlementWall = require('./runtime/EntitlementWall');

const originalCreateServer = http.createServer;
let capturedServer = null;

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 200000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

http.createServer = function wrappedCreateServer(...args) {
  const originalHandler = args[0];
  args[0] = async function dreamledgerRuntimeHandler(req, res) {
    const requestPath = String(req.url || '').split('?')[0];
    demandRadar.record('route', { route: requestPath, source: 'runtime' });

    if (req.method === 'GET' && requestPath === '/api/entitlements/check') {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      return send(res, 200, entitlementWall.entitlementFor(
        url.searchParams.get('session_id'),
        url.searchParams.get('product_id')
      ));
    }

    if (req.method === 'GET' && requestPath.startsWith('/api/goods/')) {
      const parts = requestPath.split('/').slice(3).map(decodeURIComponent);
      const productId = parts.shift();
      const relativeFile = parts.join('/') || 'index.html';
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const result = entitlementWall.readGood(url.searchParams.get('session_id'), productId, relativeFile);
      if (result.status !== 200) return send(res, result.status, result.body);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Proof': result.proof });
      return res.end(result.data);
    }

    if (req.method === 'POST' && requestPath === '/api/digital-proxy/help') {
      try {
        const body = await jsonBody(req);
        demandRadar.record('help_request', { route: requestPath, source: 'digital-proxy' });
        const result = await digitalProxyAssistant.reply(body.message, { route: body.route || requestPath });
        return send(res, 200, result);
      } catch (err) {
        return send(res, 400, { error: err.message || 'Help request failed' });
      }
    }

    if (req.method === 'GET' && requestPath === '/api/control/demand') {
      return send(res, 200, { summary: demandRadar.summary(), proposal: demandRadar.proposal() });
    }

    if (req.method === 'POST' && requestPath === '/api/control/demand/record') {
      try {
        const body = await jsonBody(req);
        return send(res, 201, demandRadar.record(body.type || 'manual_signal', body));
      } catch (err) {
        return send(res, 400, { error: err.message || 'Invalid demand signal' });
      }
    }

    if (req.method === 'GET' && requestPath === '/api/control/sentinel') {
      return send(res, 200, sentinel.run(controlPlane.health().boot.gauntlet));
    }

    if (await dreamiezAccount.handle(req, res)) return;
    if (await controlPlane.handle(req, res)) return;

    if (req.method === 'GET' && requestPath === '/') {
      const originalEnd = res.end;
      res.end = function injectedEnd(chunk, encoding, callback) {
        try {
          const contentType = String(res.getHeader('Content-Type') || '');
          if (chunk && contentType.includes('text/html')) {
            let html = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
            html = html.replace('</body>', '<script src="/assets/dreamiez-account.js"></script><script src="/assets/digital-proxy-assist.js"></script></body>');
            return originalEnd.call(this, html, 'utf8', callback);
          }
        } catch (err) {
          console.error('DreamLedger UI injection failed:', err.message);
        }
        return originalEnd.call(this, chunk, encoding, callback);
      };
    }
    return originalHandler(req, res);
  };
  capturedServer = originalCreateServer.apply(this, args);
  return capturedServer;
};

const boot = controlPlane.boot();
const sentinelResult = sentinel.run(boot.gauntlet);
console.log(JSON.stringify({ control_plane_boot: boot, sentinel: sentinelResult }, null, 2));
if (boot.status !== 'PASS' || sentinelResult.verdict !== 'PASS') {
  throw new Error('Enterprise boot gate failed; refusing to start runtime');
}

require('./server.js');

if (!capturedServer) throw new Error('BEC-PRIME server did not create an HTTP server');

if (!capturedServer.listening) {
  const port = Number(process.env.PORT || 3000);
  capturedServer.listen(port, '0.0.0.0', () => {
    console.log(`DreamLedger commerce runtime listening on 0.0.0.0:${port}`);
  });
}
