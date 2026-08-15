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
function publicAccount(user) {
  return {
    account_id: user.id,
    name: user.name || 'Customer',
    email: user.email || null,
    email_verified: user.email_verified === true,
    avatar_style: user.avatar_style || null,
    avatar: user.avatar || null,
    cosmetics: Array.isArray(user.cosmetics) ? user.cosmetics : [],
    streak: Number(user.streak || 0),
    rewards: [],
    seller: user.seller || { display_name: user.name || 'Customer', location: '', bio: '' },
    dreamiez_linked: Boolean(user.dreamiez_linked)
  };
}
async function body(req) { return new Promise((resolve, reject) => { let value = ''; req.on('data', chunk => { value += chunk; if (value.length > 1000000) req.destroy(new Error('Request too large')); }); req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch (err) { reject(err); } }); req.on('error', reject); }); }
function json(res, status, data) { if (res.writableEnded) return true; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); return true; }
function validEmail(email) { return /^\S+@\S+\.\S+$/.test(email); }

async function handle(req, res, url) {
  const route = typeof url === 'string' ? url : String(req.url || '').split('?')[0];
  const authRoute = ['/api/account/register','/api/account/login','/api/account/logout','/api/account/me','/api/account/update'].includes(route);
  if (!authRoute) return false;
  const users = readUsers();
  const sessionId = getCookie(req, COOKIE);

  if (req.method === 'GET' && route === '/api/account/me') {
    const user = sessionId ? users.find(item => item.id === sessionId && item.email) : null;
    if (!user) return json(res, 200, { authenticated: false, account: null, user: null });
    return json(res, 200, { authenticated: true, account: publicAccount(user), user: publicAccount(user) });
  }

  if (req.method === 'POST' && route === '/api/account/logout') { clearSession(res); return json(res, 200, { ok: true }); }

  if (req.method === 'POST' && route === '/api/account/login') {
    const input = await body(req);
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const user = users.find(item => String(item.email || '').toLowerCase() === email && verifyPassword(password, item.password));
    if (!user) return json(res, 401, { error: 'Invalid email or password.' });
    setSession(res, user.id);
    return json(res, 200, { ok: true, account: publicAccount(user), user: publicAccount(user), verification_required: user.email_verified !== true, next: '/account.html' });
  }

  if (req.method === 'POST' && route === '/api/account/register') {
    const input = await body(req);
    const email = String(input.email || '').trim().toLowerCase();
    const name = String(input.name || input.displayName || 'Customer').trim().slice(0, 60) || 'Customer';
    const password = String(input.password || '');
    if (!validEmail(email)) return json(res, 422, { error: 'Please enter a valid email address.' });
    if (password.length < 8) return json(res, 422, { error: 'Password must be at least 8 characters.' });
    if (users.some(item => String(item.email || '').toLowerCase() === email)) return json(res, 409, { error: 'An account with this email already exists. Log in instead.' });
    const id = 'u_' + crypto.randomBytes(12).toString('hex');
    const user = {
      id,
      name,
      email,
      email_verified: false,
      avatar: null,
      avatar_style: null,
      dreamiez_linked: false,
      cosmetics: [],
      streak: 0,
      lastVisit: null,
      guild: null,
      seller: { display_name: name, location: '', bio: '' },
      password: passwordRecord(password),
      account_created_at: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);
    setSession(res, id);
    return json(res, 201, { ok: true, verification_required: false, message: 'Account created. You are logged in. Dreamiez is optional.', account: publicAccount(user), next: '/account.html' });
  }

  if (req.method === 'POST' && route === '/api/account/update') {
    if (!sessionId) return json(res, 401, { error: 'Please log in first.' });
    const user = users.find(item => item.id === sessionId && item.email);
    if (!user) return json(res, 401, { error: 'Please log in first.' });
    const input = await body(req);
    if (input.name !== undefined) user.name = String(input.name || '').trim().slice(0, 60) || user.name;
    user.seller = {
      display_name: String(input.seller_display_name || user.seller?.display_name || user.name).trim().slice(0, 80),
      location: String(input.location || '').trim().slice(0, 100),
      bio: String(input.bio || '').trim().slice(0, 500)
    };
    writeUsers(users);
    return json(res, 200, { ok: true, account: publicAccount(user) });
  }

  return false;
}
module.exports = { handle };
