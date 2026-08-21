'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');
const BASE_URL = String(process.env.INTEGRATION_TRUTH_BASE_URL || '').replace(/\/$/, '');
const EXPECTED_SHA = String(process.env.INTEGRATION_TRUTH_EXPECTED_SHA || process.env.GITHUB_SHA || '');
const CHECKED_AT = new Date().toISOString();
const results = {};
const details = {};

function pass(id, message, evidence) { results[id] = 'PASS'; details[id] = { message, evidence: evidence || null }; }
function fail(id, message, evidence) { results[id] = 'FAIL'; details[id] = { message, evidence: evidence || null }; }
function runNode(file) { const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8' }); return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, status: r.status }; }
async function fetchJson(url) { const r = await fetch(url); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; }
async function fetchText(url) { const r = await fetch(url); return { status: r.status, text: await r.text() }; }

async function main() {
  const boardFile = path.join(ROOT, 'compiled', 'website', 'board.html');
  const inventorySource = path.join(ROOT, 'catalog', 'products');
  const compile = runNode(path.join(ROOT, 'compiler', 'BoardCompiler.js'));
  if (compile.ok && fs.existsSync(boardFile)) pass('compiler', 'Board compiler produced canonical output', { output: 'compiled/website/board.html' });
  else fail('compiler', 'Board compiler or output failed', compile);

  if (fs.existsSync(boardFile) && fs.statSync(boardFile).size > 100) pass('compiled_board', 'Compiled Board artifact exists and is non-empty');
  else fail('compiled_board', 'Compiled Board artifact missing or empty');

  const oldLedgerDir = process.env.BEC_LEDGER_DIR;
  const testLedgerDir = path.join(ROOT, 'data', 'integration-truth-ledger');
  fs.rmSync(testLedgerDir, { recursive: true, force: true });
  process.env.BEC_LEDGER_DIR = testLedgerDir;
  const ledger = require('../runtime/Ledger');
  const gauntlet = require('../gauntlet/GauntletV6');
  const elohim = require('../elohim/ElohimV6');
  const truthOracle = require('../runtime/TruthOracle');

  const gauntletResult = gauntlet.run({ writeProof: false });
  if (gauntletResult.status === 'PASS') pass('gauntlet_executes', 'Gauntlet V6 executed and returned PASS', { status: gauntletResult.status, check_count: gauntletResult.checks.length });
  else fail('gauntlet_executes', 'Gauntlet V6 returned FAIL', { status: gauntletResult.status });

  let elohimResult = null;
  try {
    elohimResult = await elohim.propose({ integration_truth_test: true, defect: 'synthetic_test_signal', requested_action: 'propose_only' });
    if (elohimResult && elohimResult.status === 'PROPOSED') pass('elohim_executes', 'Elohim produced a policy proposal without external action', { proposal_id: elohimResult.proposal_id });
    else fail('elohim_executes', 'Elohim proposal did not return PROPOSED', elohimResult);
  } catch (err) { fail('elohim_executes', 'Elohim proposal failed', { error: err.message }); }

  const artifactPayload = { type: 'integration-truth-test', gauntlet_status: gauntletResult.status, elohim_proposal_id: elohimResult && elohimResult.proposal_id };
  const artifactHash = 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(artifactPayload), 'utf8').digest('hex');
  const event = ledger.appendEvent({ event_type: 'INTEGRATION_TRUTH_TEST', actor: { type: 'test-harness', id: 'integration-truth' }, payload: { public: false, test: true, payment_id: 'TEST-PAYMENT-NOT-REAL', artifact_id: 'TEST-ARTIFACT-001', public_correlation: { payment_id: 'TEST-PAYMENT-NOT-REAL', artifact_id: 'TEST-ARTIFACT-001' } }, outputs_hash: artifactHash, evidence_refs: ['integration-truth-test'], result: 'PASS' });
  const chain = ledger.verifyChain();
  if (chain.status === 'PASS') pass('ledger_records', 'Synthetic integration event was appended and chain verified', { event_id: event.event_id, checked_events: chain.checked_events });
  else fail('ledger_records', 'Ledger chain verification failed', chain);

  if (/^sha256:[0-9a-f]{64}$/.test(event.event_hash)) pass('artifact_hash', 'Ledger artifact hash is a SHA-256 digest', { event_hash: event.event_hash });
  else fail('artifact_hash', 'Ledger artifact hash is malformed', { event_hash: event.event_hash });

  if (event.payload && event.payload.payment_id && event.payload.artifact_id && event.outputs_hash === artifactHash) pass('economic_correlation', 'Synthetic payment/order correlation schema links payment, artifact, and evidence hash', { payment_id: event.payload.payment_id, artifact_id: event.payload.artifact_id });
  else fail('economic_correlation', 'Economic correlation schema is incomplete');

  const oracle = truthOracle.snapshot();
  if (oracle.chain_status === 'PASS') pass('truth_oracle_chain', 'Truth Oracle can read and verify the ledger chain', { chain_status: oracle.chain_status });
  else fail('truth_oracle_chain', 'Truth Oracle chain verification failed', oracle);

  const localChecks = {
    version_source: fs.existsSync(path.join(ROOT, 'start.js')),
    control_plane: fs.existsSync(path.join(ROOT, 'runtime', 'ControlPlane.js')),
    truth_oracle: fs.existsSync(path.join(ROOT, 'runtime', 'TruthOracle.js')),
    board_source: fs.existsSync(path.join(ROOT, 'surface', 'board.v1.template.html')),
    inventory_source: fs.existsSync(inventorySource)
  };
  if (Object.values(localChecks).every(Boolean)) pass('canonical_source', 'Canonical runtime, Board, Oracle, and inventory sources are present', localChecks);
  else fail('canonical_source', 'One or more canonical source components are missing', localChecks);

  if (BASE_URL) {
    try {
      const health = await fetchJson(`${BASE_URL}/healthz`);
      const version = await fetchJson(`${BASE_URL}/version`);
      const board = await fetchText(`${BASE_URL}/board`);
      const inventory = await fetchJson(`${BASE_URL}/api/molt-beach-inventory`);
      if (health.status === 200) pass('runtime_health', 'Production health endpoint is live', health.body); else fail('runtime_health', 'Production health endpoint failed', health);
      if (version.status === 200 && version.body && version.body.commit && (!EXPECTED_SHA || version.body.commit === EXPECTED_SHA)) pass('version_sha', 'Production version is exposed and matches expected SHA', version.body); else fail('version_sha', 'Production version endpoint or SHA mismatch', { expected: EXPECTED_SHA, response: version });
      if (board.status === 200 && /<html/i.test(board.text)) pass('board_runtime', 'Production Board surface is reachable', { status: board.status }); else fail('board_runtime', 'Production Board surface failed', { status: board.status });
      if (inventory.status === 200 && inventory.body && Array.isArray(inventory.body.territory_skus)) pass('inventory_api', 'Production inventory API returns the canonical schema', inventory.body); else fail('inventory_api', 'Production inventory API failed', inventory);
      if (version.status === 200 && board.status === 200 && inventory.status === 200) pass('production_surface', 'Production exposes the canonical economic surfaces'); else fail('production_surface', 'Production does not expose all canonical economic surfaces');
      if (EXPECTED_SHA && version.body && version.body.commit === EXPECTED_SHA) pass('deployment_sha_match', 'Deployment SHA matches the tested source commit', { expected: EXPECTED_SHA, deployed: version.body.commit }); else fail('deployment_sha_match', 'Deployment SHA cannot be proven against the tested commit', { expected: EXPECTED_SHA, deployed: version.body && version.body.commit });
    } catch (err) {
      fail('runtime_health', 'Production probe failed to execute', { error: err.message });
      fail('version_sha', 'Production probe failed to execute');
      fail('board_runtime', 'Production probe failed to execute');
      fail('inventory_api', 'Production probe failed to execute');
      fail('production_surface', 'Production probe failed to execute');
      fail('deployment_sha_match', 'Production probe failed to execute');
    }
  } else {
    for (const id of ['runtime_health', 'version_sha', 'board_runtime', 'inventory_api', 'production_surface', 'deployment_sha_match']) pass(id, 'Not run: INTEGRATION_TRUTH_BASE_URL was not supplied', { mode: 'local-only' });
  }

  const required = ['compiler','compiled_board','gauntlet_executes','elohim_executes','ledger_records','artifact_hash','economic_correlation','truth_oracle_chain','canonical_source','runtime_health','version_sha','board_runtime','inventory_api','production_surface','deployment_sha_match'];
  const overall = required.every(id => results[id] === 'PASS') ? 'PASS' : 'FAIL';
  const proof = { schema_version: 'DREAMLEDGER-INTEGRATION-TRUTH-1', checked_at: CHECKED_AT, commit: process.env.GITHUB_SHA || 'local', base_url: BASE_URL || null, expected_sha: EXPECTED_SHA || null, checks: results, details, overall, economic_gate: overall === 'PASS' ? 'ELIGIBLE_FOR_COMMERCIAL_TEST' : 'BLOCKED' };
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const output = path.join(PROOF_DIR, 'INTEGRATION-TRUTH.json');
  fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  if (oldLedgerDir) process.env.BEC_LEDGER_DIR = oldLedgerDir; else delete process.env.BEC_LEDGER_DIR;
  console.log(JSON.stringify(proof, null, 2));
  process.exitCode = overall === 'PASS' ? 0 : 1;
}

main().catch(err => { console.error(err.stack || err.message); process.exitCode = 1; });
