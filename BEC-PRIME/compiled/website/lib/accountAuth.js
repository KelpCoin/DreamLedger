'use strict';

const crypto = require('crypto');
const localStore = process.env.DREAMLEDGER_AUTH_LOCAL_TEST === '1' ? require('./accountLocalTestStore') : null;

const COOKIE = 'dreamiez_session';
const LOCAL_TEST = process.env.DREAMLEDGER_AUTH_LOCAL_TEST === '1';

function getCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setSession(res, id) {
  res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(id) + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax');
}

function clearSession(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function verifyPassword(password, record) {
  if (!record) return false;
  const salt = record.password_salt || record.salt;
  const hash = record.password_hash || record.hash;
  if (!salt || !hash) return false;
  const actual = Buffer.from(crypto.scryptSync(password, salt, 64).toString('hex'), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

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

async function body(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => {
      value += chunk;
      if (value.length > 1000000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(value ? JSON.parse(value) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}

function validEmail(email) {
  return /^\\S+@\\S+\\.\\S+$/.test(email);
}

function validAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object' || Array.isArray(avatar)) return false;
  return ['height', 'build', 'skin'].every(key => Number.isInteger(Number(avatar[key])) && Number(avatar[key]) >= 1 && Number(avatar[key]) <= 6);
}

function dbConfig() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('Supabase auth storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return { base, key };
}

async function dbRequest(method, query, payload) {
  const cfg = dbConfig();
  const response = await fetch(cfg.base + '/rest/v1/dreamledger_accounts' + query, {
    method,
    headers: {
      apikey: cfg.key,
      Authorization: 'Bearer ' + cfg.key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const detail = data && (data.message || data.hint || data.details);
    throw new Error('Supabase auth storage request failed (' + response.status + ')' + (detail ? ': ' + detail : ''));
  }
  return data;
}

async function dbById(id) {
  const rows = await dbRequest('GET', '?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function dbByEmail(email) {
  const rows = await dbRequest('GET', '?select=*&email=eq.' + encodeURIComponent(email) + '&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function dbInsert(user) {
  const rows = await dbRequest('POST', '', user);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function dbUpdate(id, patch) {
  const rows = await dbRequest('PATCH', '?id=eq.' + encodeURIComponent(id), patch);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function findLocalById(id) {
  return localStore.read().find(item => item.id === id && item.email) || null;
}

function findLocalByEmail(email) {
  return localStore.read().find(item => String(item.email || '').toLowerCase() === email) || null;
}

async function handle(req, res, url) {
  const route = typeof url === 'string' ? url : String(req.url || '').split('?')[0];
  const authRoute = ['/api/account/register', '/api/account/login', '/api/account/logout', '/api/account/me', '/api/account/update'].includes(route);
  if (!authRoute) return false;

  const sessionId = getCookie(req, COOKIE);

  try {
    if (req.method === 'GET' && route === '/api/account/me') {
      const user = LOCAL_TEST ? findLocalById(sessionId) : (sessionId ? await dbById(sessionId) : null);
      if (!user) return json(res, 200, { authenticated: false, account: null, user: null });
      return json(res, 200, { authenticated: true, account: publicAccount(user), user: publicAccount(user) });
    }

    if (req.method === 'POST' && route === '/api/account/logout') {
      clearSession(res);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && route === '/api/account/login') {
      const input = await body(req);
      const email = String(input.email || '').trim().toLowerCase();
      const password = String(input.password || '');
      const user = LOCAL_TEST ? findLocalByEmail(email) : await dbByEmail(email);
      if (!user || !verifyPassword(password, user)) return json(res, 401, { error: 'Invalid email or password.' });
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
      const existing = LOCAL_TEST ? findLocalByEmail(email) : await dbByEmail(email);
      if (existing) return json(res, 409, { error: 'An account with this email already exists. Log in instead.' });
      const record = passwordRecord(password);
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
        last_visit: null,
        guild: null,
        seller: { display_name: name, location: '', bio: '' },
        password_salt: record.salt,
        password_hash: record.hash,
        account_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (LOCAL_TEST) {
        const users = localStore.read();
        users.push(user);
        localStore.write(users);
      } else {
        const stored = await dbInsert(user);
        if (!stored) throw new Error('Supabase auth storage returned no account row.');
      }
      setSession(res, id);
      return json(res, 201, { ok: true, verification_required: false, message: 'Account created. You are logged in. Dreamiez is optional.', account: publicAccount(user), next: '/account.html' });
    }

    if (req.method === 'POST' && route === '/api/account/update') {
      if (!sessionId) return json(res, 401, { error: 'Please log in first.' });
      const current = LOCAL_TEST ? findLocalById(sessionId) : await dbById(sessionId);
      if (!current) return json(res, 401, { error: 'Please log in first.' });
      const input = await body(req);
      if (input.avatar !== undefined && !validAvatar(input.avatar)) return json(res, 422, { error: 'Invalid avatar selection.' });
      const nextAvatar = input.avatar === undefined ? current.avatar : {
        height: Number(input.avatar.height),
        build: Number(input.avatar.build),
        skin: Number(input.avatar.skin)
      };
      const patch = {
        name: input.name !== undefined ? (String(input.name || '').trim().slice(0, 60) || current.name) : current.name,
        avatar: nextAvatar,
        seller: {
          display_name: String(input.seller_display_name || current.seller?.display_name || current.name).trim().slice(0, 80),
          location: String(input.location || current.seller?.location || '').trim().slice(0, 100),
          bio: String(input.bio || current.seller?.bio || '').trim().slice(0, 500)
        },
        updated_at: new Date().toISOString()
      };
      if (LOCAL_TEST) {
        const users = localStore.read().map(item => item.id === sessionId ? Object.assign({}, item, patch) : item);
        localStore.write(users);
        return json(res, 200, { ok: true, account: publicAccount(Object.assign({}, current, patch)) });
      }
      const updated = await dbUpdate(sessionId, patch);
      return json(res, 200, { ok: true, account: publicAccount(updated || Object.assign({}, current, patch)) });
    }

    return false;
  } catch (err) {
    console.error('DreamLedger account storage failure:', err);
    return json(res, 503, { error: err && err.message ? err.message : 'Account service unavailable.' });
  }
}

module.exports = { handle };
