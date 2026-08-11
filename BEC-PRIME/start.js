'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const dreamiezAccount = require('./dreamiez-account');
const controlPlane = require('./runtime/ControlPlane');
const demandRadar = require('./runtime/DemandRadar');
const sentinel = require('./runtime/Sentinel');
const digitalProxyAssistant = require('./proxy/DigitalProxyAssistant');
const ucp = require('./ucp');

const originalCreateServer = http.createServer;
let capturedServer = null;
const LEGAL = { '/legal/privacy': path.join(__dirname, 'legal', 'privacy.html'), '/legal/terms': path.join(__dirname, 'legal', 'terms.html') };

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 200000) req.destroy(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}
function send(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function sendLegal(res, file) {
  if (!fs.existsSync(file)) return send(res, 404, { error: 'Legal page not found' });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

http.createServer = function wrappedCreateServer(...args) {
  const originalHandler = args[0];
  args[0] = async function dreamledgerRuntimeHandler(req, res) {
    const requestPath = String(req.url || '').split('?')[0];
    demandRadar.record('route', { route: requestPath, source: 'runtime' });
    if (await ucp.handle(req, res)) return;
    if (req.method === 'GET' && LEGAL[requestPath]) return sendLegal(res, LEGAL[requestPath]);
    if (req.method === 'POST' && requestPath === '/api/digital-proxy/help') {
      try { const body = await jsonBody(req); demandRadar.record('help_request', { route: requestPath, source: 'digital-proxy' }); return send(res, 200, await digitalProxyAssistant.reply(body.message, { route: body.route || requestPath })); }
      catch (err) { return send(res, 400, { error: err.message || 'Help request failed' }); }
    }
    if (req.method === 'GET' && requestPath === '/api/control/demand') return send(res, 200, { summary: demandRadar.summary(), proposal: demandRadar.proposal() });
    if (req.method === 'POST' && requestPath === '/api/control/demand/record') {
      try { const body = await jsonBody(req); return send(res, 201, demandRadar.record(body.type || 'manual_signal', body)); }
      catch (err) { return send(res, 400, { error: err.message || 'Invalid demand signal' }); }
    }
    if (req.method === 'GET' && requestPath === '/api/control/sentinel') return send(res, 200, sentinel.run(controlPlane.health().boot.gauntlet));
    if (await dreamiezAccount.handle(req, res)) return;
    if (await controlPlane.handle(req, res)) return;
    // The compiled surface is authoritative. Runtime must not mutate it.
    return originalHandler(req, res);
  };
  capturedServer = originalCreateServer.apply(this, args);
  return capturedServer;
};

const boot = controlPlane.boot();
const sentinelResult = sentinel.run(boot.gauntlet);
console.log(JSON.stringify({ control_plane_boot: boot, sentinel: sentinelResult, ucp: { version: ucp.VERSION, profile: '/.well-known/ucp' } }, null, 2));
if (boot.status !== 'PASS' || sentinelResult.verdict !== 'PASS') throw new Error('Enterprise boot gate failed; refusing to start runtime');
require('./server.js');
if (!capturedServer) throw new Error('BEC-PRIME server did not create an HTTP server');
if (!capturedServer.listening) { const port = Number(process.env.PORT || 3000); capturedServer.listen(port, '0.0.0.0', () => console.log(`DreamLedger commerce runtime listening on 0.0.0.0:${port}`)); }
