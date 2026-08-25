'use strict';

const path = require('path');
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
const revenueAutonomy = require('../autonomy/RevenueAutonomy');

const ROOT = path.join(__dirname, '..');
const AUTONOMY_DATA = path.join(ROOT, 'data', 'autonomy');
const AUTONOMY_STATE = path.join(AUTONOMY_DATA, 'state.json');
const AUTONOMY_PROOF = path.join(AUTONOMY_DATA, 'proofs', 'AUTONOMY-LATEST.json');
let lastBoot = null;

// Runtime boot must never mutate or recompile the production surface.
// Compilation belongs to the build/deployment phase. Boot verifies that the
// immutable build artifacts required by the runtime are present, then runs
// the existing trust gates over those artifacts.
function compile() {
  const requiredArtifacts = [
    ['catalog:offers', path.join(ROOT, 'catalog', 'offers', 'offers.json')],
    ['catalog:approved', path.join(ROOT, 'catalog', 'offers', 'approved.json')],
    ['catalog:ip', path.join(ROOT, 'catalog', 'ip-capabilities.json')],
    ['surface:index', path.join(ROOT, 'compiled', 'website', 'index.html')],
    ['surface:marketplace', path.join(ROOT, 'compiled', 'website', 'assets', 'marketplace-live.js')]
  ];
  return requiredArtifacts.map(([name, file]) => ({
    name,
    status: require('fs').existsSync(file) ? 'PASS' : 'FAIL',
    stdout: '',
    stderr: require('fs').existsSync(file) ? '' : `Missing runtime artifact: ${file}`
  }));
}

function readJsonFile(file, fallback) {
  try { return JSON.parse(require('fs').readFileSync(file, 'utf8')); } catch { return fallback; }
}

function revenueSnapshot() {
  return {
    autonomy: readJsonFile(AUTONOMY_PROOF, { status: 'NOT_RUN' }),
    state: readJsonFile(AUTONOMY_STATE, { paid_events: [], rabbit_mode: 'LOCKED', rabbit_trigger: 'WAITING_FOR_PAID_EVENTS' }),
    approval_boundary: 'REQUIRED',
    public_actions_executed: false
  };
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
    revenue_autonomy: revenueSnapshot(),
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
    worker_pool: { status: 'READY', jobs: workerPool.listJobs() },
    revenue_autonomy: revenueSnapshot(),
    boot: lastBoot || { status: 'NOT_BOOTED' }
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
  if (req.method === 'GET' && url === '/api/control/revenue') return send(200, revenueSnapshot());
  if (req.method === 'POST' && url === '/api/control/revenue/cycle') {
    try {
      const proof = await revenueAutonomy.cycle();
      return send(proof.status === 'PASS' ? 200 : 500, proof);
    } catch (err) {
      return send(500, { status: 'FAIL', error: err.message || 'Revenue autonomy cycle failed', approval_boundary: 'REQUIRED', public_actions_executed: false });
    }
  }
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
