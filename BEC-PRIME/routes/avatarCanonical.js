'use strict';

// Canonical DreamMeez avatar runtime.
// Production persistence lives in Supabase. The legacy users.json avatar/cosmetics
// fields are read only as a migration source and are never the authoritative store.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const COSMETICS = path.join(DATA_ROOT, 'cosmetics.json');
const COOKIE = 'dreamiez_session';

function cookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function config() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('Canonical avatar storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return { base, key };
}

async function dbRequest(method, table, query, payload) {
  const cfg = config();
  const response = await fetch(cfg.base + '/rest/v1/' + table + query, {
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
    throw new Error('Supabase avatar request failed (' + response.status + ')' + (detail ? ': ' + detail : ''));
  }
  return data;
}

async function accountById(accountId) {
  if (!accountId) return null;
  const rows = await dbRequest('GET', 'dreamledger_accounts', '?select=id,name,email,email_verified,avatar,avatar_style,cosmetics& id=eq.' + encodeURIComponent(accountId) + '&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function avatarByAccount(accountId) {
  const rows = await dbRequest('GET', 'dreammeez_avatars', '?select=*&account_id=eq.' + encodeURIComponent(accountId) + '&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function ensureAvatar(accountId, account, requestedAppearance) {
  let avatar = await avatarByAccount(accountId);
  if (avatar) return avatar;
  const legacy = requestedAppearance ? normalizeAppearance(requestedAppearance) : (account && account.avatar ? normalizeAppearance(account.avatar) : { height: 2, build: 2, skin: 5 });
  const inserted = await dbRequest('POST', 'dreammeez_avatars', '', {
    account_id: accountId,
    appearance: legacy,
    equipped: {},
    progression: {}
  });
  avatar = Array.isArray(inserted) ? inserted[0] : null;
  if (!avatar) throw new Error('Canonical avatar creation returned no row.');
  await migrateLegacyOwnership(accountId, account);
  return avatar;
}

function normalizeAppearance(value) {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { input = {}; }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  return {
    height: clampInt(input.height, 0, 4, 2),
    build: clampInt(input.build, 0, 4, 2),
    skin: clampInt(input.skin, 0, 9, 5)
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function catalog() {
  try {
    const rows = JSON.parse(fs.readFileSync(COSMETICS, 'utf8'));
    return Array.isArray(rows) ? rows.map(normalizeCosmetic) : [];
  } catch {
    return [];
  }
}

function normalizeCosmetic(item) {
  const id = String(item.id || '');
  return {
    id,
    item_id: item.product_id || canonicalFreeItem(id),
    name: String(item.name || id),
    slot: String(item.slot || 'accessory'),
    price_nzd: Number(item.price_nzd || 0),
    streak_reward: item.streak_reward == null ? null : Number(item.streak_reward),
    product_id: item.product_id || null,
    game_usable: true
  };
}

function canonicalFreeItem(id) {
  const map = {
    'free-cap': 'DRMZ-ITM-003',
    'free-jacket': 'DRMZ-ITM-004',
    'free-goldchain': 'DRMZ-ITM-005'
  };
  return map[id] || null;
}

async function migrateLegacyOwnership(accountId, account) {
  const legacy = Array.isArray(account && account.cosmetics) ? account.cosmetics : [];
  if (!legacy.length) return;
  const byId = new Map(catalog().map(item => [item.id, item]));
  for (const legacyId of legacy) {
    const item = byId.get(String(legacyId));
    if (!item || !item.item_id) continue;
    await dbRequest('POST', 'dreammeez_avatar_items', '?on_conflict=account_id,item_id', {
      account_id: accountId,
      item_id: item.item_id,
      source: 'legacy_migration'
    });
  }
}

async function ownership(accountId) {
  const rows = await dbRequest('GET', 'dreammeez_avatar_items', '?select=item_id,acquired_at,source&account_id=eq.' + encodeURIComponent(accountId) + '&order=acquired_at.asc');
  return Array.isArray(rows) ? rows : [];
}

async function setAvatar(accountId, appearance) {
  const next = normalizeAppearance(appearance);
  const current = await avatarByAccount(accountId);
  if (!current) return ensureAvatar(accountId, await accountById(accountId), next);
  const rows = await dbRequest('PATCH', 'dreammeez_avatars', '?account_id=eq.' + encodeURIComponent(accountId) + '&version=eq.' + encodeURIComponent(String(current.version)), { appearance: next });
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Avatar changed concurrently. Reload and retry.');
  return rows[0];
}

async function equip(accountId, itemId, slot) {
  const avatar = await avatarByAccount(accountId);
  if (!avatar) throw new Error('Canonical avatar does not exist.');
  const owned = await dbRequest('GET', 'dreammeez_avatar_items', '?select=item_id&account_id=eq.' + encodeURIComponent(accountId) + '&item_id=eq.' + encodeURIComponent(itemId) + '&limit=1');
  if (!Array.isArray(owned) || !owned[0]) {
    const error = new Error('Cosmetic is not owned by this avatar.');
    error.statusCode = 403;
    throw error;
  }
  const item = catalog().find(x => x.item_id === itemId);
  if (!item) {
    const error = new Error('Unknown cosmetic.');
    error.statusCode = 404;
    throw error;
  }
  if (slot && String(slot) !== item.slot) {
    const error = new Error('Cosmetic does not belong to that equipment slot.');
    error.statusCode = 422;
    throw error;
  }
  const equipped = Object.assign({}, avatar.equipped || {});
  equipped[item.slot] = item.item_id;
  const rows = await dbRequest('PATCH', 'dreammeez_avatars', '?account_id=eq.' + encodeURIComponent(accountId) + '&version=eq.' + encodeURIComponent(String(avatar.version)), { equipped });
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Avatar changed concurrently. Reload and retry.');
  return rows[0];
}

function accountProjection(account, avatar, items) {
  const owned = new Set(items.map(x => x.item_id));
  const available = catalog().map(item => ({ ...item, owned: owned.has(item.item_id), equipped: Object.values(avatar.equipped || {}).includes(item.item_id) }));
  return {
    account_id: account.id,
    name: account.name || 'Dreamer',
    email: account.email || null,
    email_verified: account.email_verified === true,
    streak: 0,
    avatar_id: avatar.avatar_id,
    avatar_style: account.avatar_style || 'dream',
    avatar: avatar.appearance,
    equipped: avatar.equipped || {},
    progression: avatar.progression || {},
    avatar_version: avatar.version,
    cosmetics: available.filter(x => x.owned).map(x => x.id),
    inventory: available,
    rewards: [],
    dreamiez_linked: true
  };
}

async function handle(req, res, url) {
  const route = typeof url === 'string' ? url : String(req.url || '').split('?')[0];
  if (!route.startsWith('/api/dreamiez/avatar') && route !== '/api/dreamiez/me' && route !== '/api/dreamiez/cosmetics') return false;
  const accountId = cookie(req, COOKIE);
  if (!accountId) {
    const error = new Error('login required');
    error.statusCode = 401;
    throw error;
  }
  const account = await accountById(accountId);
  if (!account) {
    const error = new Error('account not found');
    error.statusCode = 401;
    throw error;
  }
  const avatar = await ensureAvatar(accountId, account);
  const items = await ownership(accountId);

  if (req.method === 'GET' && route === '/api/dreamiez/cosmetics') return send(res, 200, catalog());
  if (req.method === 'GET' && route === '/api/dreamiez/me') return send(res, 200, accountProjection(account, avatar, items));
  if (req.method === 'GET' && route === '/api/dreamiez/avatar/state') return send(res, 200, { avatar: accountProjection(account, avatar, items) });
  if (req.method === 'GET' && route === '/api/dreamiez/avatar/inventory') return send(res, 200, { items: accountProjection(account, avatar, items).inventory });
  if (req.method === 'POST' && route === '/api/dreamiez/avatar') {
    const b = await body(req);
    if (account.email && account.email_verified !== true) {
      const error = new Error('Verify your email first.');
      error.statusCode = 403;
      throw error;
    }
    const next = await setAvatar(accountId, b);
    return send(res, 200, { success: true, account: accountProjection(account, next, await ownership(accountId)) });
  }
  if (req.method === 'POST' && route === '/api/dreamiez/avatar/equip') {
    const b = await body(req);
    const itemId = String(b.item_id || b.cosmetic_id || '').trim();
    if (!itemId) {
      const error = new Error('item_id is required');
      error.statusCode = 422;
      throw error;
    }
    const next = await equip(accountId, itemId, b.slot);
    return send(res, 200, { success: true, account: accountProjection(account, next, await ownership(accountId)) });
  }
  return false;
}

async function body(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => {
      value += chunk;
      if (value.length > 1000000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(value ? JSON.parse(value) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}

module.exports = { handle, normalizeAppearance, catalog };
