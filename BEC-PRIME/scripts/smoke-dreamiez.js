'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.SMOKE_PORT || 38765);
const base = `http://127.0.0.1:${port}`;
const email = `smoke-${crypto.randomUUID()}@example.test`;
const password = 'DreamiezSmokePass!2026';
const proxyToken = process.env.DIGITAL_PROXY_APPROVAL_TOKEN || 'smoke-proxy-token';
let child;

async function request(pathname, options = {}) {
  const r = await fetch(base + pathname, options);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) throw new Error(`${options.method || 'GET'} ${pathname} -> ${r.status}: ${text}`);
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
  const commanderPath = path.join(__dirname, '..', 'catalog', 'products', 'COMMANDER-DECK-DIAGNOSTIC-001.json');
  const commander = JSON.parse(fs.readFileSync(commanderPath, 'utf8'));
  assert(commander.price === 1500 && commander.currency === 'nzd', 'Commander canonical price must remain 1500 NZ cents');
  const marketplaceAsset = fs.readFileSync(path.join(__dirname, '..', 'compiled', 'website', 'assets', 'marketplace-live.js'), 'utf8');
  assert(marketplaceAsset.includes('raw>=1000') && marketplaceAsset.includes('raw/100'), 'Marketplace price formatter is not cents-aware');

  child = spawn(process.execPath, ['start.js'], { cwd: __dirname + '/..', env: { ...process.env, PORT: String(port), DIGITAL_PROXY_APPROVAL_TOKEN: proxyToken, LEDGER_DATA_DIR: `/tmp/dreamledger-smoke-${process.pid}/transactions`, PROOF_DATA_DIR: `/tmp/dreamledger-smoke-${process.pid}/proofs`, DREAMIEZ_DATA_DIR: `/tmp/dreamledger-smoke-${process.pid}/dreamiez` }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => process.stdout.write(`[runtime] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[runtime] ${d}`));
  await waitForHealth();

  const control = await request('/api/control/health');
  assert(control.body.control_plane === 'ELOHIM-V6', 'Elohim v6 control plane missing');
  assert(control.body.gauntlet === 'GAUNTLET-V6', 'Gauntlet v6 missing');
  assert(control.body.boot.status === 'PASS', 'Control-plane boot gate failed');
  assert(control.body.boot.gauntlet.status === 'PASS', 'Gauntlet v6 failed');

  const root = await request('/');
  assert(String(root.body).includes('/assets/dreamiez-account.js'), 'Dreamiez account UI was not injected into the public surface');

  const created = await request('/api/dreamiez/account/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, name: 'Smoke Dreamer', avatar_style: 'dream' }) });
  assert(created.body.ok === true, 'Account creation failed');
  assert(created.body.account.streak === 1, 'New account did not start at streak 1');
  assert(created.body.account.avatar_style === 'dream', 'Avatar style was not persisted');
  const cookie = created.response.headers.get('set-cookie');
  assert(cookie && cookie.includes('dreamiez_session='), 'Session cookie missing');

  const me = await request('/api/dreamiez/me', { headers: { cookie } });
  assert(me.body.account.streak === 1, 'Same-day account read changed streak unexpectedly');
  assert(me.body.account.avatar_style === 'dream', 'Avatar state was not returned from the server');
  assert(Array.isArray(me.body.rewards), 'Rewards payload missing');
  assert(me.body.rewards.some(r => r.day === 1 && r.unlocked), 'Day 1 reward not unlocked');
  assert(me.body.rewards.some(r => r.day === 7 && !r.unlocked), 'Day 7 reward should remain locked');

  const login = await request('/api/dreamiez/account/login', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ email, password }) });
  assert(login.body.ok === true, 'Login failed');
  assert(login.body.account.streak === 1, 'Repeated same-day login incorrectly incremented streak');

  const rewards = await request('/api/dreamiez/rewards', { headers: { cookie } });
  assert(rewards.body.streak === 1, 'Rewards endpoint streak mismatch');
  assert(rewards.body.rewards.some(r => r.day === 1 && r.unlocked && r.asset), 'Day 1 Elohim reward asset missing');
  assert(rewards.body.rewards.some(r => r.day === 7 && !r.unlocked && r.asset === null), 'Locked reward leaked its asset');

  const proposal = await request('/api/control/elohim/propose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goal: 'Generate a Dreamiez reward asset', account_id: created.body.account.account_id, reward_day: 1, streak: 1 }) });
  assert(proposal.body.status === 'PROPOSED', 'Elohim proposal was not created');
  assert(Array.isArray(proposal.body.forbidden_without_human_approval), 'Elohim approval boundary missing');

  const queued = await request('/api/control/proxy/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'elohim.propose', payload: { smoke: true }, requested_by: 'smoke-test' }) });
  assert(queued.body.status === 'PENDING_APPROVAL', 'Digital Proxy did not create an approval-gated action');
  const approval = await request(`/api/control/proxy/approve/${queued.body.action_id}`, { method: 'POST', headers: { 'x-human-approver': 'smoke-human', 'x-digital-proxy-token': proxyToken } });
  assert(approval.body.status === 'APPROVED', 'Digital Proxy approval transition failed');

  console.log(JSON.stringify({ smoke_test: 'PASS', commander_price_cents: 1500, commander_display_price_nzd: 15, account_created: true, avatar_persisted: true, streak_started_at: 1, same_day_idempotent: true, day_1_reward_unlocked: true, day_7_reward_locked: true, elohim_reward_asset: true, login_verified: true, public_surface_injected: true, elohim_v6: true, gauntlet_v6: true, digital_proxy_approval_gate: true }, null, 2));
}

main().catch(err => { console.error(JSON.stringify({ smoke_test: 'FAIL', error: err.message }, null, 2)); process.exitCode = 1; }).finally(() => { if (child) child.kill('SIGTERM'); });
