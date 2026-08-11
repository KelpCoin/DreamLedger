'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const gauntlet = require('../gauntlet/GauntletV6');
const elohim = require('../elohim/ElohimV6');
const proxy = require('../proxy/DigitalProxy');

const ROOT = path.join(__dirname, '..');
let lastBoot = null;

function compile() {
  const steps = [
    ['compile:offers', path.join(ROOT, 'compiler', 'OfferCompiler.js')],
    ['compile:surface', path.join(ROOT, 'compiler', 'SurfaceCompiler.js')]
  ];
  const results = [];
  for (const [name, file] of steps) {
    const result = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8' });
    results.push({ name, status: result.status === 0 ? 'PASS' : 'FAIL', stdout: result.stdout, stderr: result.stderr });
    if (result.status !== 0) break;
  }
  return results;
}

function boot() {
  const compileResults = compile();
  const gauntletResult = gauntlet.run();
  lastBoot = { compile: compileResults, gauntlet: gauntletResult, status: compileResults.every(x => x.status === 'PASS') && gauntletResult.status === 'PASS' ? 'PASS' : 'FAIL', checked_at: new Date().toISOString() };
  return lastBoot;
}

function health() {
  return { control_plane: 'ELOHIM-V6', gauntlet: 'GAUNTLET-V6', digital_proxy: 'approval-gated', boot: lastBoot || { status: 'NOT_BOOTED' } };
}

async function handle(req, res) {
  const url = String(req.url || '').split('?')[0];
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && url === '/api/control/health') return send(200, health());
  if (req.method === 'POST' && url === '/api/control/compile') return send(200, boot());
  if (req.method === 'POST' && url === '/api/control/gauntlet') return send(200, gauntlet.run());
  if (req.method === 'POST' && url === '/api/control/elohim/propose') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let input = {}; try { input = JSON.parse(body || '{}'); } catch { return send(400, { error: 'Invalid JSON' }); }
    try { return send(200, await elohim.propose(input)); } catch (err) { return send(400, { error: err.message }); }
  }
  if (req.method === 'POST' && url === '/api/control/proxy/queue') {
    let body = ''; for await (const chunk of req) body += chunk;
    let input; try { input = JSON.parse(body || '{}'); } catch { return send(400, { error: 'Invalid JSON' }); }
    try { return send(201, proxy.queue(input.action, input.payload, input.requested_by)); } catch (err) { return send(400, { error: err.message }); }
  }
  if (req.method === 'POST' && url.startsWith('/api/control/proxy/approve/')) {
    const id = url.slice('/api/control/proxy/approve/'.length);
    try { return send(200, proxy.approve(id, req.headers['x-human-approver'] || 'human')); } catch (err) { return send(403, { error: err.message }); }
  }
  return false;
}

module.exports = { handle, boot, health };
