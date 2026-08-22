'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const autoRevenueCatalog = require('../catalog/AutoRevenueCatalog');
const gauntlet = require('../gauntlet/GauntletV6');
const elohim = require('../elohim/ElohimV6');
const proxy = require('../proxy/DigitalProxy');
const sentinel = require('./Sentinel');
const demandRadar = require('./DemandRadar');
const workerPool = require('./worker-pool');
const scheduler = require('./Scheduler');
const ledger = require('./Ledger');
const fossil = require('./Fossil');
const truthOracle = require('./TruthOracle');
const internalTrust = require('../trust/InternalTrustService');
const agentAuthority = require('./AgentAuthority');

const ROOT = path.join(__dirname, '..');
let lastBoot = null;

function compile() {
  const catalogResult = autoRevenueCatalog.ensure();
  const steps = [
    ['compile:products', path.join(ROOT, 'compiler', 'ProductCompiler.js')],
    ['compile:offers', path.join(ROOT, 'compiler', 'OfferCompiler.js')],
    ['compile:surface', path.join(ROOT, 'compiler', 'SurfaceCompiler.js')]
  ];
  const results = [{ name: 'generate:auto-revenue-catalog', status: catalogResult.count === 100 ? 'PASS' : 'FAIL', stdout: JSON.stringify(catalogResult), stderr: '' }];
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
  const sentinelResult = sentinel.run(gauntletResult);
  const ledgerResult = ledger.verifyChain();
  const fossilResult = fossil.verifyFossils();
  lastBoot = {
    compile: compileResults,
    gauntlet: gauntletResult,
    sentinel: sentinelResult,
    ledger: ledgerResult,
    fossils: fossilResult,
    truth_oracle: truthOracle.snapshot(),
    workers: scheduler.advertisedWorkers().workers,
    worker_pool: { status: 'READY', queue: workerPool.listJobs().length },
    status: compileResults.every(x => x.status === 'PASS') && gauntletResult.status === 'PASS' && sentinelResult.verdict === 'PASS' && ledgerResult.status === 'PASS' && fossilResult.status === 'PASS' ? 'PASS' : 'FAIL',
    checked_at: new Date().toISOString()
  };
  return lastBoot;
}

function health() {
  return {
    control_plane: 'ELOHIM-V6', gauntlet: 'GAUNTLET-V6', digital_proxy: 'approval-gated',
    scheduler: { registry: scheduler.loadRegistry(), workers: scheduler.advertisedWorkers().workers },
    ledger: ledger.verifyChain(), fossils: fossil.verifyFossils(), truth_oracle: truthOracle.snapshot(),
    worker_pool: { status: 'READY', jobs: workerPool.listJobs() }, boot: lastBoot || { status: 'NOT_BOOTED' }
  };
}

async function readJsonBody(req) { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 200000) throw new Error('Request too large'); } try { return JSON.parse(body || '{}'); } catch { throw new Error('Invalid JSON'); } }

function internalTrustAuthorized(req) {
  const configured = process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN || '';
  const supplied = String(req.headers['x-dreamledger-internal-token'] || '');
  return Boolean(configured) && supplied === configured;
}

async function handle(req, res) {
  const url = String(req.url || '').split('?')[0];
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  if (url.startsWith('/api/agent-authority')) return agentAuthority.handle(req, res);
  if (req.method === 'GET' && url === '/api/truth-oracle') return send(200, truthOracle.snapshot());
  if (req.method === 'GET' && url === '/truth-oracle') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(truthOracle.html()); }
  if (req.method === 'GET' && url === '/api/control/health') return send(200, health());
  if (req.method === 'GET' && url === '/api/control/sentinel') return send(200, sentinel.run(gauntlet.run()));
  if (req.method === 'GET' && url === '/api/control/demand') return send(200, { summary: demandRadar.summary(), proposal: demandRadar.proposal() });
  if (req.method === 'GET' && url === '/api/control/demand/record') return send(405, { error: 'Use POST to record demand' });
  if (req.method === 'POST' && url === '/api/control/demand/record') { try { const input = await readJsonBody(req); return send(201, demandRadar.record(input.type || 'manual_signal', input)); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/compile') return send(200, boot());
  if (req.method === 'POST' && url === '/api/control/gauntlet') return send(200, gauntlet.run());
  if (req.method === 'GET' && url === '/api/control/jobs') return send(200, { jobs: workerPool.listJobs() });
  if (req.method === 'POST' && url === '/api/control/jobs') { try { const input = await readJsonBody(req); const job = workerPool.createJob(input); return send(201, { status: 'QUEUED', job, route: scheduler.choose(job) }); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/jobs/run-once') { const result = await workerPool.runNext(); return send(result.status === 'FAILED' ? 500 : 200, result); }
  if (req.method === 'GET' && url === '/api/control/workers') return send(200, scheduler.advertisedWorkers());
  if (req.method === 'GET' && url === '/api/control/ledger') return send(200, ledger.verifyChain());
  if (req.method === 'GET' && url === '/api/control/fossils') return send(200, fossil.verifyFossils());
  if (req.method === 'GET' && url.startsWith('/api/control/jobs/')) { const jobId = url.slice('/api/control/jobs/'.length); try { return send(200, workerPool.loadJob(jobId)); } catch (err) { return send(404, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/trust/verify') {
    if (!internalTrustAuthorized(req)) return send(process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 401 : 503, { error: process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 'Unauthorized' : 'Internal trust service not configured' });
    try { const input = await readJsonBody(req); return send(200, { verification: await internalTrust.verify(input.candidate) }); } catch (err) { return send(400, { error: err.message }); }
  }
  if (req.method === 'POST' && url === '/api/control/elohim/propose') { try { return send(200, await elohim.propose(await readJsonBody(req))); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/proxy/queue') { try { const input = await readJsonBody(req); return send(201, proxy.queue(input.action, input.payload, input.requested_by)); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url.startsWith('/api/control/proxy/approve/')) { const id = url.slice('/api/control/proxy/approve/'.length); try { return send(200, proxy.approve(id, req.headers['x-human-approver'] || 'human', req.headers['x-digital-proxy-token'] || '')); } catch (err) { return send(403, { error: err.message }); } }
  return false;
}

module.exports = { handle, boot, health };