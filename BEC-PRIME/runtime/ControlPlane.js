'use strict';

const path = require('path');
const fs = require('fs');
const gauntlet = require('../gauntlet/SecurityGauntletV7');
const legacyGauntlet = require('../gauntlet/GauntletV6');
const elohim = require('../elohim/ElohimV7');
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
const mcpSecurity = require('../security/McpSecurity');
const compilerMirror = require('../compiler/CompilerMirrorV1');

const ROOT = path.join(__dirname, '..');
let lastBoot = null;

function compile() {
  const requiredArtifacts = [
    ['catalog:offers', path.join(ROOT, 'catalog', 'offers', 'offers.json')],
    ['catalog:approved', path.join(ROOT, 'catalog', 'offers', 'approved.json')],
    ['catalog:ip', path.join(ROOT, 'catalog', 'ip-capabilities.json')],
    ['surface:index', path.join(ROOT, 'compiled', 'website', 'index.html')],
    ['surface:marketplace', path.join(ROOT, 'compiled', 'website', 'assets', 'marketplace-live.js')]
  ];
  return requiredArtifacts.map(([name, file]) => ({ name, status: fs.existsSync(file) ? 'PASS' : 'FAIL', stdout: '', stderr: fs.existsSync(file) ? '' : `Missing runtime artifact: ${file}` }));
}

function boot() {
  const compileResults = compile();
  const securityResult = gauntlet.run();
  const legacyResult = legacyGauntlet.run({ writeProof: false });
  const sentinelResult = sentinel.run(legacyResult);
  const ledgerResult = ledger.verifyChain();
  const fossilResult = fossil.verifyFossils();
  let manifestResult;
  try { manifestResult = mcpSecurity.verifyToolManifest(); } catch (err) { manifestResult = { status: 'FAIL', error: err.message }; }
  lastBoot = {
    compile: compileResults,
    security_gauntlet: securityResult,
    legacy_gauntlet: legacyResult,
    sentinel: sentinelResult,
    ledger: ledgerResult,
    fossils: fossilResult,
    mcp_manifest: manifestResult,
    truth_oracle: truthOracle.snapshot(),
    workers: scheduler.advertisedWorkers().workers,
    worker_pool: { status: 'READY', queue: workerPool.listJobs().length },
    status: compileResults.every(x => x.status === 'PASS') && securityResult.status === 'PASS' && sentinelResult.verdict === 'PASS' && ledgerResult.status === 'PASS' && fossilResult.status === 'PASS' && manifestResult.status === 'PASS' ? 'PASS' : 'FAIL',
    checked_at: new Date().toISOString()
  };
  return lastBoot;
}

function health() {
  return {
    control_plane: 'ELOHIM-V7',
    gauntlet: 'SECURITY-GAUNTLET-V7',
    compiler_mirror: 'COMPILER-MIRROR-V1',
    mcp_gateway: 'DREAMLEDGER-GATEWAY-V2',
    digital_proxy: 'approval-gated',
    scheduler: { registry: scheduler.loadRegistry(), workers: scheduler.advertisedWorkers().workers },
    ledger: ledger.verifyChain(), fossils: fossil.verifyFossils(), truth_oracle: truthOracle.snapshot(),
    mcp_manifest: (() => { try { return mcpSecurity.verifyToolManifest(); } catch (e) { return { status: 'FAIL', error: e.message }; } })(),
    worker_pool: { status: 'READY', jobs: workerPool.listJobs() }, boot: lastBoot || { status: 'NOT_BOOTED' }
  };
}

async function readJsonBody(req) { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 200000) throw new Error('Request too large'); } try { return JSON.parse(body || '{}'); } catch { throw new Error('Invalid JSON'); } }
function internalTrustAuthorized(req) { const configured = process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN || ''; const supplied = String(req.headers['x-dreamledger-internal-token'] || ''); return Boolean(configured) && supplied === configured; }
function controlMutationAuthorized(req) {
  const configured = process.env.DREAMLEDGER_CONTROL_TOKEN || process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN || '';
  const supplied = String(req.headers['x-dreamledger-control-token'] || req.headers['x-dreamledger-internal-token'] || '');
  return Boolean(configured) && cryptoSafeEqual(supplied, configured);
}
function cryptoSafeEqual(a, b) {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && require('crypto').timingSafeEqual(A, B);
}
function denyMutation(req, res) { if (controlMutationAuthorized(req)) return false; res.writeHead(process.env.DREAMLEDGER_CONTROL_TOKEN || process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 401 : 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: process.env.DREAMLEDGER_CONTROL_TOKEN || process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 'Control authorization required' : 'Control plane mutation token not configured' })); return true; }

async function handle(req, res) {
  const url = String(req.url || '').split('?')[0];
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  if (url.startsWith('/api/agent-authority')) return agentAuthority.handle(req, res);
  if (req.method === 'GET' && url === '/api/truth-oracle') return send(200, truthOracle.snapshot());
  if (req.method === 'GET' && url === '/truth-oracle') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(truthOracle.html()); }
  if (req.method === 'GET' && url === '/api/control/health') return send(200, health());
  if (req.method === 'GET' && url === '/api/control/sentinel') return send(200, sentinel.run(legacyGauntlet.run({ writeProof: false })));
  if (req.method === 'GET' && url === '/api/control/demand') return send(200, { summary: demandRadar.summary(), proposal: demandRadar.proposal() });
  if (req.method === 'GET' && url === '/api/control/demand/record') return send(405, { error: 'Use POST to record demand' });
  if (req.method === 'POST' && url === '/api/control/demand/record') { if (denyMutation(req, res)) return true; try { const input = await readJsonBody(req); return send(201, demandRadar.record(input.type || 'manual_signal', input)); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/compile') { if (denyMutation(req, res)) return true; return send(200, boot()); }
  if (req.method === 'POST' && url === '/api/control/gauntlet') { if (denyMutation(req, res)) return true; return send(200, gauntlet.run()); }
  if (req.method === 'GET' && url === '/api/control/jobs') return send(200, { jobs: workerPool.listJobs() });
  if (req.method === 'POST' && url === '/api/control/jobs') { if (denyMutation(req, res)) return true; try { const input = await readJsonBody(req); const job = workerPool.createJob(input); return send(201, { status: 'QUEUED', job, route: scheduler.choose(job) }); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/jobs/run-once') { if (denyMutation(req, res)) return true; const result = await workerPool.runNext(); return send(result.status === 'FAILED' ? 500 : 200, result); }
  if (req.method === 'GET' && url === '/api/control/workers') return send(200, scheduler.advertisedWorkers());
  if (req.method === 'GET' && url === '/api/control/ledger') return send(200, ledger.verifyChain());
  if (req.method === 'GET' && url === '/api/control/fossils') return send(200, fossil.verifyFossils());
  if (req.method === 'GET' && url.startsWith('/api/control/jobs/')) { const jobId = url.slice('/api/control/jobs/'.length); try { return send(200, workerPool.loadJob(jobId)); } catch (err) { return send(404, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/trust/verify') { if (!internalTrustAuthorized(req)) return send(process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 401 : 503, { error: process.env.DREAMLEDGER_INTERNAL_TRUST_TOKEN ? 'Unauthorized' : 'Internal trust service not configured' }); try { const input = await readJsonBody(req); return send(200, { verification: await internalTrust.verify(input.candidate) }); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/elohim/propose') { if (denyMutation(req, res)) return true; try { return send(200, await elohim.propose(await readJsonBody(req))); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/control/proxy/queue') { if (denyMutation(req, res)) return true; try { const input = await readJsonBody(req); return send(201, proxy.queue(input.action, input.payload, input.requested_by)); } catch (err) { return send(400, { error: err.message }); } }
  if (req.method === 'POST' && url.startsWith('/api/control/proxy/approve/')) { if (denyMutation(req, res)) return true; const id = url.slice('/api/control/proxy/approve/'.length); try { return send(200, proxy.approve(id, req.headers['x-human-approver'] || 'human', req.headers['x-digital-proxy-token'] || '')); } catch (err) { return send(403, { error: err.message }); } }
  return false;
}

module.exports = { handle, boot, health };
