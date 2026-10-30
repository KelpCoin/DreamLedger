'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.join(__dirname, 'credential-gate.cjs');
function run(kind, value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-cloud-gate-'));
  try {
    const env = { ...process.env };
    delete env.STRIPE_SECRET_KEY;
    delete env.RENDER_API_KEY;
    if (kind === 'stripe' && value) env.STRIPE_SECRET_KEY = value;
    if (kind === 'render' && value) env.RENDER_API_KEY = value;
    const p = spawnSync(process.execPath, [script, kind], { cwd: dir, env, encoding: 'utf8' });
    const file = path.join(dir, 'proof', 'cloud', kind + '-credential-presence.json');
    return { code: p.status, stdout: p.stdout, stderr: p.stderr, proof: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
for (const kind of ['stripe', 'render']) {
  test(kind + ': missing credential is a hard HOLD with proof', () => {
    const v = run(kind);
    assert.equal(v.code, 1);
    assert.equal(JSON.parse(v.proof).status, 'HOLD_MISSING_CREDENTIAL');
    assert.equal(JSON.parse(v.proof).pc_required, false);
  });
  test(kind + ': configured means present, not authenticated', () => {
    const secret = 'SENSITIVE_TEST_VALUE_DO_NOT_LOG';
    const v = run(kind, secret);
    assert.equal(v.code, 0);
    assert.equal(JSON.parse(v.proof).status, 'CONFIGURED_NOT_AUTHENTICATED');
    assert.equal(JSON.parse(v.proof).provider_authenticated, false);
    assert.ok(!(v.stdout + v.stderr + v.proof).includes(secret));
  });
}
test('unknown gate rejected', () => assert.equal(run('unknown').code, 2));
