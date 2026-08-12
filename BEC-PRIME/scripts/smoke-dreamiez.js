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
const smokeRoot = `/tmp/dreamledger-smoke-${process.pid}`;
const ledgerDir = `${smokeRoot}/transactions`;
const proofDir = `${smokeRoot}/proofs`;
const dreamiezDir = `${smokeRoot}/dreamiez`;
const demandDir = `${smokeRoot}/demand`;
let child;
let cookie;

async function request(pathname, options = {}, allowError = false) { const r = await fetch(base + pathname, options); const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; } if (!r.ok && !allowError) throw new Error(`${options.method || 'GET'} ${pathname} -> ${r.status}: ${text}`); return { response: r, body }; }
function assert(condition, message) { if (!condition) throw new Error(message); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function spawnRuntime() {
  child = spawn(process.execPath, ['-r', './lib/publicShellPreload.js', '-r', './lib/m2mPreload.js', '-r', './lib/qrPreload.js', 'start.js'], { cwd: __dirname + '/..', env: { ...process.env, PORT: String(port), DIGITAL_PROXY_APPROVAL_TOKEN: proxyToken, LEDGER_DATA_DIR: ledgerDir, PROOF_DATA_DIR: proofDir, DREAMIEZ_DATA_DIR: dreamiezDir, DEMAND_RADAR_DATA_DIR: demandDir, DIGITAL_PROXY_LM_ENABLED: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => process.stdout.write(`[runtime] ${d}`)); child.stderr.on('data', d => process.stderr.write(`[runtime] ${d}`));
}
async function waitForHealth() { for (let i = 0; i < 50; i += 1) { try { const x = await request('/healthz'); if (x.body.status === 'ok') return x.body; } catch {} await sleep(200); } throw new Error('Runtime did not become healthy'); }
async function stopRuntime() { if (!child) return; child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); child = null; await sleep(150); }
async function main() {
  const commanderPath = path.join(__dirname, '..', 'catalog', 'products', 'COMMANDER-DECK-DIAGNOSTIC-001.json'); const commander = JSON.parse(fs.readFileSync(commanderPath, 'utf8')); assert(commander.price === 1500 && commander.currency === 'nzd', 'Commander canonical price must remain 1500 NZ cents');
  const marketplaceAsset = fs.readFileSync(path.join(__dirname, '..', 'compiled', 'website', 'assets', 'marketplace-live.js'), 'utf8'); assert(marketplaceAsset.includes('raw>=1000') && marketplaceAsset.includes('raw/100'), 'Marketplace price formatter is not cents-aware');
  spawnRuntime(); const health = await waitForHealth(); assert(health.status === 'ok', 'Health endpoint did not return ok');
  const offers = await request('/api/offers'); assert(Array.isArray(offers.body.offers), 'Offer catalog endpoint did not return an offers array'); const commanderOffer = offers.body.offers.find(o => o.offer_id === 'OFFER-BEC-PRIME-COMMANDER-DIAGNOSTIC-001'); if (commanderOffer) { assert(commanderOffer.price === 15, 'Commander offer API price must be 15 NZD'); assert(commanderOffer.currency === 'NZD', 'Commander offer API currency must be NZD'); }
  const control = await request('/api/control/health'); assert(control.body.control_plane === 'ELOHIM-V6', 'Elohim v6 control plane missing'); assert(control.body.gauntlet === 'GAUNTLET-V6', 'Gauntlet v6 missing'); assert(control.body.boot.status === 'PASS', 'Control-plane boot gate failed'); assert(control.body.boot.gauntlet.status === 'PASS', 'Gauntlet v6 failed');
  const sentinel = await request('/api/control/sentinel'); assert(sentinel.body.verdict === 'PASS', 'Sentinel verdict failed'); assert(fs.existsSync(path.join(proofDir, 'SENTINEL-LATEST.json')), 'Sentinel proof artifact missing');
  const demand = await request('/api/control/demand'); assert(demand.body.summary && demand.body.summary.schema === 'BEC-PRIME/DEMAND-RADAR/v1', 'Demand Radar missing');
  const root = await request('/'); assert(String(root.body).includes('/assets/dreamiez-account.js'), 'Dreamiez account UI was not injected'); assert(String(root.body).includes('/assets/digital-proxy-assist.js'), 'Digital Proxy UI was not injected');
  const help = await request('/api/digital-proxy/help', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'How do I use my Dreamiez account?', route: '/' }) }); assert(typeof help.body.reply === 'string' && help.body.reply.length > 10, 'Opt-in Digital Proxy help did not respond');
  const created = await request('/api/dreamiez/account/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, name: 'Smoke Dreamer', avatar_style: 'dream' }) }); assert(created.body.ok === true, 'Account creation failed'); assert(created.body.account.streak === 1, 'New account did not start at streak 1'); assert(created.body.account.avatar_style === 'dream', 'Avatar style was not persisted'); cookie = created.response.headers.get('set-cookie'); assert(cookie && cookie.includes('dreamiez_session='), 'Session cookie missing');
  const me = await request('/api/dreamiez/me', { headers: { cookie } }); assert(me.body.account.streak === 1, 'Same-day account read changed streak unexpectedly'); assert(me.body.account.avatar_style === 'dream', 'Avatar state was not returned'); assert(me.body.rewards.some(r => r.day === 1 && r.unlocked), 'Day 1 reward not unlocked'); assert(me.body.rewards.some(r => r.day === 7 && !r.unlocked), 'Day 7 reward should remain locked');
  const login = await request('/api/dreamiez/account/login', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ email, password }) }); assert(login.body.ok === true, 'Login failed'); assert(login.body.account.streak === 1, 'Repeated same-day login incorrectly incremented streak');
  const rewards = await request('/api/dreamiez/rewards', { headers: { cookie } }); assert(rewards.body.streak === 1, 'Rewards endpoint streak mismatch'); assert(rewards.body.rewards.some(r => r.day === 1 && r.unlocked && r.asset), 'Day 1 Elohim reward asset missing'); assert(rewards.body.rewards.some(r => r.day === 7 && !r.unlocked && r.asset === null), 'Locked reward leaked its asset');
  const proposal = await request('/api/control/elohim/propose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goal: 'Generate a Dreamiez reward asset', account_id: created.body.account.account_id, reward_day: 1, streak: 1 }) }); assert(proposal.body.status === 'PROPOSED', 'Elohim proposal was not created'); assert(Array.isArray(proposal.body.forbidden_without_human_approval), 'Elohim approval boundary missing');
  const queued = await request('/api/control/proxy/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'elohim.propose', payload: { smoke: true }, requested_by: 'smoke-test' }) }); assert(queued.body.status === 'PENDING_APPROVAL', 'Digital Proxy did not create an approval-gated action'); const denied = await request(`/api/control/proxy/approve/${queued.body.action_id}`, { method: 'POST', headers: { 'x-human-approver': 'smoke-human', 'x-digital-proxy-token': 'wrong-token' } }, true); assert(denied.response.status === 403, 'Digital Proxy accepted an invalid approval token'); const approval = await request(`/api/control/proxy/approve/${queued.body.action_id}`, { method: 'POST', headers: { 'x-human-approver': 'smoke-human', 'x-digital-proxy-token': proxyToken } }); assert(approval.body.status === 'APPROVED', 'Digital Proxy approval transition failed');
  const demandAfterHelp = await request('/api/control/demand'); assert(demandAfterHelp.body.summary.event_count >= 1, 'Demand Radar did not record runtime demand'); assert(demandAfterHelp.body.proposal.status === 'PROPOSED', 'Demand Radar did not produce a proposal');
  await stopRuntime(); spawnRuntime(); await waitForHealth(); const persisted = await request('/api/dreamiez/me', { headers: { cookie } }); assert(persisted.body.account.streak === 1, 'Account streak did not persist across runtime restart'); assert(persisted.body.account.avatar_style === 'dream', 'Avatar did not persist across runtime restart'); assert(persisted.body.rewards.some(r => r.day === 1 && r.unlocked && r.asset), 'Elohim reward did not persist across runtime restart');
  console.log(JSON.stringify({ smoke_test: 'PASS', commander_price_cents: 1500, commander_display_price_nzd: 15, account_created: true, avatar_persisted: true, streak_started_at: 1, same_day_idempotent: true, persistence_across_restart: true, day_1_reward_unlocked: true, day_7_reward_locked: true, elohim_reward_asset: true, login_verified: true, public_surface_injected: true, digital_proxy_opt_in: true, digital_proxy_invalid_token_blocked: true, demand_radar: true, sentinel: true, api_offers_verified: true, elohim_v6: true, gauntlet_v6: true, digital_proxy_approval_gate: true }, null, 2));
}
main().catch(err => { console.error(JSON.stringify({ smoke_test: 'FAIL', error: err.message }, null, 2)); process.exitCode = 1; }).finally(async () => { await stopRuntime(); });
