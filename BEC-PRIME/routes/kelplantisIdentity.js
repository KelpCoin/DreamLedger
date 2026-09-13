'use strict';

// Cross-game identity adapter. Kelplantis gameplay state remains in its existing
// player tables; DreamMeez remains the authoritative avatar identity.
const sessionCookie = require('../lib/sessionCookie');

function config() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('Kelplantis identity storage is not configured.');
  return { base, key };
}

async function dbRequest(method, table, query, payload) {
  const cfg = config();
  const response = await fetch(cfg.base + '/rest/v1/' + table + query, {
    method,
    headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const detail = data && (data.message || data.hint || data.details);
    throw new Error('Supabase Kelplantis identity request failed (' + response.status + ')' + (detail ? ': ' + detail : ''));
  }
  return data;
}

async function body(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => { value += chunk; if (value.length > 100000) req.destroy(new Error('Request too large')); });
    req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}

function error(message, statusCode) { const err = new Error(message); err.statusCode = statusCode; return err; }

async function handle(req, res, url) {
  const route = typeof url === 'string' ? url : String(req.url || '').split('?')[0];
  if (route !== '/api/kelplantis/identity') return false;
  const accountId = sessionCookie.get(req);
  if (!accountId) throw error('login required', 401);

  const accounts = await dbRequest('GET', 'dreamledger_accounts', '?select=id,name&id=eq.' + encodeURIComponent(accountId) + '&limit=1');
  if (!Array.isArray(accounts) || !accounts[0]) throw error('account not found', 401);

  const avatars = await dbRequest('GET', 'dreammeez_avatars', '?select=avatar_id,account_id,appearance,equipped,progression,version&account_id=eq.' + encodeURIComponent(accountId) + '&limit=1');
  if (!Array.isArray(avatars) || !avatars[0]) throw error('canonical avatar not initialized', 409);
  const avatar = avatars[0];

  if (req.method === 'GET') {
    const players = await dbRequest('GET', 'kelplantis_players', '?select=*&account_id=eq.' + encodeURIComponent(accountId) + '&limit=1');
    return send(res, 200, { account_id: accountId, avatar_id: avatar.avatar_id, avatar: avatar.appearance, equipped: avatar.equipped || {}, progression: avatar.progression || {}, player: Array.isArray(players) && players[0] ? players[0] : null, bound: Boolean(Array.isArray(players) && players[0]) });
  }

  if (req.method === 'POST') {
    const input = await body(req);
    const playerId = String(input.player_id || '').trim();
    if (!playerId) throw error('player_id is required', 422);
    if (!/^[0-9a-f-]{36}$/i.test(playerId)) throw error('player_id must be a UUID', 422);

    const players = await dbRequest('GET', 'kelplantis_players', '?select=id,account_id,avatar_id,name,player_token&id=eq.' + encodeURIComponent(playerId) + '&limit=1');
    if (!Array.isArray(players) || !players[0]) throw error('Kelplantis player not found', 404);
    const player = players[0];
    if (player.account_id && player.account_id !== accountId) throw error('Kelplantis player belongs to another account', 409);
    if (player.avatar_id && player.avatar_id !== avatar.avatar_id) throw error('Kelplantis player is bound to another avatar', 409);

    const updated = await dbRequest('PATCH', 'kelplantis_players', '?id=eq.' + encodeURIComponent(playerId), { account_id: accountId, avatar_id: avatar.avatar_id });
    return send(res, 200, { success: true, account_id: accountId, avatar_id: avatar.avatar_id, player: Array.isArray(updated) && updated[0] ? updated[0] : null });
  }

  throw error('Method not allowed', 405);
}

function send(res, status, data) { if (res.writableEnded) return true; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); return true; }

module.exports = { handle };