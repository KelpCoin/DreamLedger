'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const USERS = path.join(DATA_ROOT, 'users.json');
const COOKIE = 'dreamiez_session';

function readUsers() { try { return JSON.parse(fs.readFileSync(USERS, 'utf8')); } catch { return []; } }
function writeUsers(users) { fs.mkdirSync(path.dirname(USERS), { recursive: true }); const tmp = USERS + '.tmp-' + process.pid + '-' + Date.now(); fs.writeFileSync(tmp, JSON.stringify(users, null, 2) + '\n'); fs.renameSync(tmp, USERS); }
function getCookie(req, name) { const raw = String(req.headers.cookie || ''); const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return match ? decodeURIComponent(match[1]) : null; }
function setSession(res, id) { res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(id) + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax'); }
function clearSession(res) { res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'); }
function passwordRecord(password) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }; }
function verifyPassword(password, record) { if (!record || !record.salt || !record.hash) return false; const a = Buffer.from(crypto.scryptSync(password, record.salt, 64).toString('hex'), 'hex'); const b = Buffer.from(record.hash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function publicAccount(user) { return { account_id: user.id, name: user.name || 'Dreamer', email: user.email || null, email_verified: user.email_verified === true, avatar_style: user.avatar_style || 'dream', avatar: user.avatar || { height: 2, build: 2, skin: 5 }, cosmetics: Array.isArray(user.cosmetics) ? user.cosmetics : [], streak: Number(user.streak || 0), rewards: [] }; }
async function body(req) { return new Promise((resolve, reject) => { let value = ''; req.on('data', chunk => { value += chunk; if (value.length > 1000000) req.destroy(new Error('Request too large')); }); req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch (err) { reject(err); } }); req.on('error', reject); }); }
function json(res, status, data) { if (res.writableEnded) return true; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); return true; }
function validEmail(email) { return /^\S+@\S+\.\S+$/.test(email); }

async function handle(req, res, url) {
  const route = typeof url === 'string' ? url : String(req.url || '').split('?')[0];
  const authRoute = ['/api/account/register','/api/account/login','/api/account/logout','/api/account/me','/api/dreamiez/account/create','/api/dreamiez/account/login','/api/dreamiez/account/logout','/api/dreamiez/me'].includes(route);
  if (!authRoute) return false;
  const users = readUsers();
  const sessionId = getCookie(req, COOKIE);

  if (req.method === 'GET' && (route === '/api/account/me' || route === '/api/dreamiez/me')) {
    const user = sessionId ? users.find(item => item.id === sessionId) : null;
    if (!user) return json(res, 200, { authenticated: false, account: null, user: null, rewards: [] });
    return json(res, 200, { authenticated: true, account: publicAccount(user), user: publicAccount(user), rewards: [] });
  }
  if (req.method === 'POST' && (route === '/api/account/logout' || route === '/api/dreamiez/account/logout')) { clearSession(res); return json(res, 200, { ok: true }); }
  if (req.method === 'POST' && (route === '/api/account/login' || route === '/api/dreamiez/account/login')) {
    const input = await body(req); const email = String(input.email || '').trim().toLowerCase(); const password = String(input.password || ''); const user = users.find(item => String(item.email || '').toLowerCase() === email);
    if (!user || !verifyPassword(password, user.password)) return json(res, 401, { error: 'Invalid email or password.' });
    setSession(res, user.id); return json(res, 200, { ok: true, account: publicAccount(user), user: publicAccount(user), verification_required: user.email_verified !== true, next: '/account.html' });
  }
  if (req.method === 'POST' && (route === '/api/account/register' || route === '/api/dreamiez/account/create')) {
    const input = await body(req); const email = String(input.email || '').trim().toLowerCase(); const name = String(input.name || input.displayName || 'Dreamer').trim().slice(0, 60) || 'Dreamer'; const password = String(input.password || '');
    if (!validEmail(email)) return json(res, 422, { error: 'Please enter a valid email address.' });
    if (password.length < 8) return json(res, 422, { error: 'Password must be at least 8 characters.' });
    if (users.some(item => String(item.email || '').toLowerCase() === email)) return json(res, 409, { error: 'An account with this email already exists. Log in instead.' });
    const id = 'u_' + crypto.randomBytes(12).toString('hex');
    const user = { id, name, email, email_verified: false, avatar: { height: 2, build: 2, skin: 5 }, avatar_style: String(input.avatar_style || input.avatarStyle || 'dream').slice(0, 30), cosmetics: [], streak: 1, lastVisit: new Date().toISOString().slice(0, 10), guild: null, password: passwordRecord(password), account_created_at: new Date().toISOString() };
    users.push(user); writeUsers(users); setSession(res, id);
    return json(res, 201, { ok: true, verification_required: true, verification_sent: false, message: 'Account created. You are logged in. Email verification is required before selling.', account: publicAccount(user), next: '/account.html' });
  }
  return false;
}
module.exports = { handle };
