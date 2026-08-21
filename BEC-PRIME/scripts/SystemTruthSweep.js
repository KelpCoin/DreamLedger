const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const baseUrl = process.env.DREAMLEDGER_BASE_URL || 'https://dreamledger.org';
const expectedSha = process.env.EXPECTED_SHA || '';
const root = path.resolve(__dirname, '..');
const proofDir = process.env.PROOF_DIR || path.join(root, 'RUN-PROOFS');
fs.mkdirSync(proofDir, { recursive: true });

function run(cmd, args) {
  try { return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { return ''; }
}

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) {}
  return { status: r.status, body, text: text.slice(0, 4000) };
}

async function main() {
  const started = new Date().toISOString();
  const localSha = run('git', ['rev-parse', 'HEAD']);
  const clean = run('git', ['status', '--porcelain']) === '';
  const proof = {
    schema: 'dreamledger.system-truth-sweep.v1',
    run_id: crypto.randomUUID(),
    timestamp_utc: started,
    repository: 'KelpCoin/DreamLedger',
    local: { sha: localSha || null, clean },
    production: {},
    compiler: {},
    economic: { external_cash_received: false, next_gate: 'E1_FIRST_EXTERNAL_PAYMENT' },
    status: 'UNPROVEN',
    failures: [],
    warnings: []
  };

  try {
    const version = await getJson(`${baseUrl}/version`);
    proof.production.version_http = version.status;
    proof.production.live_sha = version.body && version.body.commit ? String(version.body.commit) : null;
    proof.production.version_ok = version.status === 200 && !!proof.production.live_sha && (!expectedSha || proof.production.live_sha === expectedSha);
    if (!proof.production.version_ok) proof.failures.push('LIVE_VERSION_MISMATCH_OR_UNAVAILABLE');
  } catch (e) { proof.failures.push(`VERSION_PROBE_FAILED:${e.message}`); }

  try {
    const health = await getJson(`${baseUrl}/healthz`);
    proof.production.health_http = health.status;
    proof.production.health_ok = health.status === 200;
    if (!proof.production.health_ok) proof.failures.push('HEALTHZ_FAILED');
  } catch (e) { proof.failures.push(`HEALTH_PROBE_FAILED:${e.message}`); }

  const compile = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'compile']);
  proof.compiler.compile_ok = !!compile;
  proof.compiler.compile_output_tail = compile.slice(-2000);
  if (!proof.compiler.compile_ok) proof.failures.push('CANONICAL_COMPILE_FAILED');

  const universal = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'compile:universal']);
  proof.compiler.universal_ok = /PASS|pass|success/i.test(universal);
  proof.compiler.universal_output_tail = universal.slice(-2000);
  if (!proof.compiler.universal_ok) proof.failures.push('UNIVERSAL_COMPILER_FAILED');

  proof.compiler.public_surface = ['compiled/website/index.html', 'compiled/website/login.html', 'compiled/website/register.html']
    .map(p => ({ path: p, exists: fs.existsSync(path.join(root, p)) }));
  if (proof.compiler.public_surface.some(x => !x.exists)) proof.failures.push('PUBLIC_COMPILED_SURFACE_INCOMPLETE');

  proof.status = proof.failures.length === 0 ? 'SYSTEM_TRUTH_PASS' : 'SYSTEM_TRUTH_FAIL';
  const json = JSON.stringify(proof, null, 2) + '\n';
  const latest = path.join(proofDir, 'SYSTEM-TRUTH-LATEST.json');
  const stamp = started.replace(/[-:TZ.]/g, '').slice(0, 14);
  const dated = path.join(proofDir, `SYSTEM-TRUTH-${stamp}.json`);
  fs.writeFileSync(latest, json, 'utf8');
  fs.writeFileSync(dated, json, 'utf8');
  console.log(json);
  process.exit(proof.status === 'SYSTEM_TRUTH_PASS' ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
