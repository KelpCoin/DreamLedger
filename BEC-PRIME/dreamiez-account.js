'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const elohim = require('./elohim/ElohimV6');

const ROOT = path.resolve(process.env.DREAMIEZ_DATA_DIR || path.join(__dirname, 'data', 'dreamiez'));
const STORE = path.join(ROOT, 'accounts.json');
const SESSIONS = path.join(ROOT, 'sessions.json');
const REWARDS = [
  { day: 1, tier: 'WELCOME', name: 'Dreamiez Spark', description: 'Your first Elohim-generated Dreamiez asset.' },
  { day: 3, tier: 'RISING', name: 'Dreamiez Signal', description: 'A streak-only Elohim-generated signal asset.' },
  { day: 7, tier: 'WEEKLY', name: 'Dreamiez Prime', description: 'A premium Elohim-generated asset unlocked by a seven-day streak.' },
  { day: 14, tier: 'FORTNIGHT', name: 'Dreamiez Ascendant', description: 'A high-tier Elohim-generated asset for sustained daily presence.' },
  { day: 30, tier: 'MONTHLY', name: 'Dreamiez Crown', description: 'The top recurring streak reward in Dreamiez V1.' }
];

function ensureStore() {
  fs.mkdirSync(ROOT, { recursive: true });
  if (!fs.existsSync(STORE)) fs.writeFileSync(STORE, '{}\n', 'utf8');
  if (!fs.existsSync(SESSIONS)) fs.writeFileSync(SESSIONS, '{}\n', 'utf8');
}
function read(file) { ensureStore(); return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { ensureStore(); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function nowIso() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function yesterday() { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
function id() { return crypto.randomUUID(); }
function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function passwordRecord(password) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashPassword(password, salt) }; }
function verifyPassword(password, record) { const actual = Buffer.from(hashPassword(password, record.salt), 'hex'); const expected = Buffer.from(record.hash, 'hex'); return actual.length === expected.length && crypto.timingSafeEqual(actual, expected); }
function parseCookies(req) { const out = {}; String(req.headers.cookie || '').split(';').forEach(part => { const i = part.indexOf('='); if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }); return out; }
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function cookie(res, token, maxAge) { res.setHeader('Set-Cookie', `dreamiez_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`); }
async function body(req) { let s = ''; for await (const chunk of req) { s += chunk; if (s.length > 100000) throw new Error('Request too large'); } return JSON.parse(s || '{}'); }
function publicAccount(a) { return { account_id: a.account_id, email: a.email, name: a.name, avatar_style: a.avatar_style, created_at: a.created_at, streak: a.streak, last_checkin: a.last_checkin, best_streak: a.best_streak, reward_level: rewardLevel(a.streak) }; }
function rewardLevel(streak) { return Math.max(...REWARDS.filter(r => streak >= r.day).map(r => r.day), 0); }
function rewardAsset(account, reward) {
  const asset = elohim.generateReward({ account_id: account.account_id, reward_day: reward.day, streak: account.streak });
  return { ...asset, tier: reward.tier, name: reward.name, description: reward.description };
}
function updateStreak(account) {
  const t = today();
  if (account.last_checkin === t) return false;
  if (account.last_checkin === yesterday()) account.streak += 1;
  else account.streak = 1;
  account.best_streak = Math.max(account.best_streak || 0, account.streak);
  account.last_checkin = t;
  account.updated_at = nowIso();
  return true;
}
function currentAccount(req) {
  const token = parseCookies(req).dreamiez_session;
  if (!token) return null;
  const sessions = read(SESSIONS);
  const s = sessions[token];
  if (!s) return null;
  if (s.expires_at < Date.now()) { delete sessions[token]; write(SESSIONS, sessions); return null; }
  const accounts = read(STORE);
  return accounts[s.account_id] || null;
}
function setSession(res, accountId) {
  const sessions = read(SESSIONS);
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { account_id: accountId, expires_at: Date.now() + 1000 * 60 * 60 * 24 * 30 };
  write(SESSIONS, sessions);
  cookie(res, token, 60 * 60 * 24 * 30);
}
function checkin(req, res) {
  const account = currentAccount(req);
  if (!account) return send(res, 401, { error: 'Authentication required' });
  const accounts = read(STORE);
  const changed = updateStreak(account);
  accounts[account.account_id] = account;
  write(STORE, accounts);
  const unlocked = REWARDS.filter(r => account.streak >= r.day).map(r => rewardAsset(account, r));
  return send(res, 200, { ok: true, checked_in: changed, account: publicAccount(account), rewards: unlocked, streak_rule: 'Daily check-ins preserve the streak. Missing a calendar day resets the active streak to 1 and removes access to rewards above day 1 until re-earned.' });
}
async function handle(req, res) {
  const url = req.url.split('?')[0];
  if (!url.startsWith('/api/dreamiez/')) return false;
  try {
    if (req.method === 'POST' && url === '/api/dreamiez/account/create') {
      const b = await body(req);
      const email = String(b.email || '').trim().toLowerCase();
      const password = String(b.password || '');
      const name = String(b.name || 'Dreamer').trim().slice(0, 32) || 'Dreamer';
      if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 422, { error: 'Valid email required' });
      if (password.length < 8) return send(res, 422, { error: 'Password must be at least 8 characters' });
      const accounts = read(STORE);
      if (Object.values(accounts).some(a => a.email === email)) return send(res, 409, { error: 'Account already exists' });
      const accountId = id();
      const account = { account_id: accountId, email, name, avatar_style: ['dream', 'night', 'gold'].includes(b.avatar_style) ? b.avatar_style : 'dream', password: passwordRecord(password), created_at: nowIso(), updated_at: nowIso(), streak: 1, last_checkin: today(), best_streak: 1 };
      accounts[accountId] = account; write(STORE, accounts); setSession(res, accountId);
      return send(res, 201, { ok: true, account: publicAccount(account), rewards: [rewardAsset(account, REWARDS[0])] });
    }
    if (req.method === 'POST' && url === '/api/dreamiez/account/login') {
      const b = await body(req); const email = String(b.email || '').trim().toLowerCase(); const password = String(b.password || '');
      const accounts = read(STORE); const account = Object.values(accounts).find(a => a.email === email);
      if (!account || !verifyPassword(password, account.password)) return send(res, 401, { error: 'Invalid email or password' });
      setSession(res, account.account_id); updateStreak(account); accounts[account.account_id] = account; write(STORE, accounts);
      return send(res, 200, { ok: true, account: publicAccount(account), rewards: REWARDS.filter(r => account.streak >= r.day).map(r => rewardAsset(account, r)) });
    }
    if (req.method === 'POST' && url === '/api/dreamiez/account/logout') {
      const token = parseCookies(req).dreamiez_session; const sessions = read(SESSIONS); if (token) delete sessions[token]; write(SESSIONS, sessions); cookie(res, '', 0); return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url === '/api/dreamiez/me') {
      const account = currentAccount(req); if (!account) return send(res, 401, { error: 'Not logged in' });
      const accounts = read(STORE); updateStreak(account); accounts[account.account_id] = account; write(STORE, accounts);
      return send(res, 200, { ok: true, account: publicAccount(account), rewards: REWARDS.map(r => ({ ...r, unlocked: account.streak >= r.day, asset: account.streak >= r.day ? rewardAsset(account, r) : null })) });
    }
    if (req.method === 'POST' && url === '/api/dreamiez/checkin') return checkin(req, res);
    if (req.method === 'GET' && url === '/api/dreamiez/rewards') {
      const account = currentAccount(req); if (!account) return send(res, 401, { error: 'Authentication required' });
      return send(res, 200, { streak: account.streak, rewards: REWARDS.map(r => ({ ...r, unlocked: account.streak >= r.day, asset: account.streak >= r.day ? rewardAsset(account, r) : null })) });
    }
    return send(res, 404, { error: 'Dreamiez account route not found' });
  } catch (err) { return send(res, 400, { error: err.message || 'Request failed' }); }
}

module.exports = { handle };
