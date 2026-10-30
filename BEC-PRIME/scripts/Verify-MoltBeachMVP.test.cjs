'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const src = path.join(__dirname, 'Verify-MoltBeachMVP.js');
function fixture(complete, forbidden) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-molt-gate-'));
  function put(p, value) {
    const f = path.join(root, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, value);
  }
  try {
    put('BEC-PRIME/scripts/Verify-MoltBeachMVP.js', fs.readFileSync(src, 'utf8'));
    put('BEC-PRIME/compiler/MoltBeachCompiler.js', '// source fixture');
    put('BEC-PRIME/surface/molt-beach.v1.template.html',
      '.board{width: 1000px; height: 1000px} 1000 x 1000 canvas' + (forbidden ? ' Amplissa' : ''));
    put('public/server.js', '// /billboard');
    if (complete) {
      put('api/molt-beach-inventory.ts', '// molt_beach_campaigns');
      put('api/molt-beach-checkout.ts', '// STRIPE_SECRET_KEY');
      put('api/molt-beach-webhook.ts', '// checkout.session.completed');
    }
    const p = spawnSync(process.execPath,
      [path.join(root, 'BEC-PRIME/scripts/Verify-MoltBeachMVP.js')],
      { encoding: 'utf8' });
    const proof = JSON.parse(fs.readFileSync(path.join(root, 'PROOF-MOLT-BEACH-MVP.json'), 'utf8'));
    return { exitCode: p.status, proof };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('missing source files fail and create a proof', () => {
  const r = fixture(false, false);
  assert.equal(r.exitCode, 1);
  assert.equal(r.proof.status, 'FAIL');
  assert.deepEqual(r.proof.missing_files.sort(),
    ['api/molt-beach-checkout.ts', 'api/molt-beach-inventory.ts', 'api/molt-beach-webhook.ts']);
});
test('synthetic files only pass source checks, not commercial certification', () => {
  const r = fixture(true, false);
  assert.equal(r.exitCode, 0);
  assert.equal(r.proof.status, 'PASS');
  assert.deepEqual(r.proof.missing_files, []);
});
test('forbidden cross-silo content remains blocked', () => {
  const r = fixture(true, true);
  assert.equal(r.exitCode, 1);
  assert.equal(r.proof.status, 'FAIL');
  assert.ok(r.proof.checks.some(c => c.name === 'public silo gate amplissa' && c.status === 'FAIL'));
});
