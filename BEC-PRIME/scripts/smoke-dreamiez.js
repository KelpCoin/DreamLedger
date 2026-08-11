'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');

const port = Number(process.env.SMOKE_PORT || 38765);
const base = `http://127.0.0.1:${port}`;
const email = `smoke-${crypto.randomUUID()}@example.test`;
const password = 'DreamiezSmokePass!2026';
let child;

async function request(path, options = {}) {
  const r = await fetch(base + path, options);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${r.status}: ${text}`);
  return { response: r, body };
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForHealth() {
  for (let i = 0; i < 50; i += 1) {
    try { const x = await request('/healthz'); if (x.body.status === 'ok') return; } catch {}
    await sleep(200);
  }
  throw new Error('Runtime did not become healthy');
}

async function main() {
  child = spawn(process.execPath, ['start.js'], { cwd: __dirname + '/..', env: { ...process.env, PORT: String(port), LEDGER_DATA_DIR: `/tmp/dreamledger-smoke-${process.pid}/transactions`, PROOF_DATA_DIR: `/tmp/dreamledger-smoke-${process.pid}/proofs` }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => process.stdout.write(`[runtime] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[runtime] ${d}`));
  await waitForHealth();

  const root = await request('/');
  assert(String(root.body).includes('/assets/dreamiez-account.js'), 'Dreamiez account UI was not injected into the public surface');

  const created = await request('/api/dreamiez/account/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, name: 'Smoke Dreamer', avatar_style: 'dream' }) });
  assert(created.body.ok === true, 'Account creation failed');
  assert(created.body.account.streak === 1, 'New account did not start at streak 1');
  const cookie = created.response.headers.get('set-cookie');
  assert(cookie && cookie.includes('dreamiez_session='), 'Session cookie missing');

  const me = await request('/api/dreamiez/me', { headers: { cookie } });
  assert(me.body.account.streak === 1, 'Same-day account read changed streak unexpectedly');
  assert(Array.isArray(me.body.rewards), 'Rewards payload missing');
  assert(me.body.rewards.some(r => r.day === 1 && r.unlocked), 'Day 1 reward not unlocked');
  assert(me.body.rewards.some(r => r.day === 7 && !r.unlocked), 'Day 7 reward should remain locked');

  const login = await request('/api/dreamiez/account/login', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ email, password }) });
  assert(login.body.ok === true, 'Login failed');
  assert(login.body.account.streak === 1, 'Repeated same-day login incorrectly incremented streak');

  const rewards = await request('/api/dreamiez/rewards', { headers: { cookie } });
  assert(rewards.body.streak === 1, 'Rewards endpoint streak mismatch');

  console.log(JSON.stringify({ smoke_test: 'PASS', account_created: true, streak_started_at: 1, same_day_idempotent: true, day_1_reward_unlocked: true, day_7_reward_locked: true, login_verified: true, public_surface_injected: true }, null, 2));
}

main().catch(err => { console.error(JSON.stringify({ smoke_test: 'FAIL', error: err.message }, null, 2)); process.exitCode = 1; }).finally(() => { if (child) child.kill('SIGTERM'); });
