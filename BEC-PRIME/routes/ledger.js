'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const QRCode = require('qrcode');

const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(__dirname, '..', 'data', 'dreamiez'));
const USERS = path.join(DATA_ROOT, 'users.json');
const COOKIE = 'dreamiez_session';
const BASE = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const PUBLIC_BASE = String(process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');

function sendBinary(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(data);
  return true;
}

function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}

function html(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
  return true;
}

function cookie(req) {
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)dreamiez_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function users() {
  try { return JSON.parse(fs.readFileSync(USERS, 'utf8')); } catch { return []; }
}

function currentUser(req) {
  const id = cookie(req);
  return id ? users().find(u => u && u.id === id && u.email) : null;
}

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>\\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\\"': '&quot;', "'": '&#39;' }[c]));
}

function validHandle(v) {
  return /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(v);
}

function normalizeHandle(v) {
  return String(v || '').trim().toLowerCase();
}

function validItemType(v) {
  return ['link', 'product', 'collection', 'story', 'drop', 'billboard', 'proof'].includes(String(v || ''));
}

async function supabase(resource, options = {}) {
  if (!BASE || !KEY) throw new Error('Supabase persistence is not configured');
  const r = await fetch(BASE + '/rest/v1/' + resource, {
    ...options,
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const e = new Error(data && data.message ? data.message : 'Supabase request failed');
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}

async function getLedger(handle) {
  const rows = await supabase(
    'dream_ledgers?select=id,handle,display_name,bio,avatar_url,dreammeez_id,theme,permanence_year,created_at,updated_at,status,owner_account_id&handle=eq.' +
    encodeURIComponent(handle) + '&status=eq.active&limit=1'
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getItems(id) {
  return supabase(
    'dream_ledger_items?select=id,item_type,title,body,target,position,created_at,updated_at&ledger_id=eq.' +
    encodeURIComponent(id) + '&published=eq.true&order=position.asc,created_at.desc&limit=50'
  );
}

async function getFollowCount(id) {
  const rows = await supabase('dream_ledger_follows?select=follower_user_id&ledger_id=eq.' + encodeURIComponent(id));
  return Array.isArray(rows) ? rows.length : 0;
}

async function getDiscoverLedgers() {
  return supabase(
    'dream_ledgers?select=id,handle,display_name,bio,avatar_url,dreammeez_id,theme,permanence_year,created_at,status&status=eq.active&order=created_at.desc&limit=40'
  );
}

function publicLedger(l) {
  return {
    id: l.id,
    handle: l.handle,
    display_name: l.display_name,
    bio: l.bio,
    avatar_url: l.avatar_url,
    dreammeez_id: l.dreammeez_id,
    theme: l.theme,
    permanence_year: l.permanence_year,
    created_at: l.created_at
  };
}

function page(l, items, followCount) {
  const title = (l.display_name || l.handle) + ' | Dream Ledger 3000';
  const description = (l.bio || 'A persistent Ledger on Dream Ledger 3000.').slice(0, 160);
  const canonical = PUBLIC_BASE + '/u/' + encodeURIComponent(l.handle);
  const image = l.avatar_url ? '<meta property="og:image" content="' + esc(l.avatar_url) + '">' : '';
  const avatar = l.avatar_url ? '<img class="avatar" src="' + esc(l.avatar_url) + '" alt="">' : '<div class="avatar"></div>';
  const cards = items.map(i => {
    const inner = '<b>' + esc(i.title) + '</b><span>' + esc(i.body || i.item_type) + '</span>';
    return i.target && /^https?:\/\//i.test(i.target)
      ? '<a class="card" href="' + esc(i.target) + '" rel="noopener noreferrer">' + inner + '</a>'
      : '<div class="card">' + inner + '</div>';
  }).join('');
  const dream = l.dreammeez_id ? '<div class="chip">DreamMeez linked</div>' : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(description) + '">' +
    '<link rel="canonical" href="' + esc(canonical) + '"><meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '"><meta property="og:url" content="' + esc(canonical) + '">' +
    image + '<meta name="twitter:card" content="summary">' +
    '<script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: l.display_name || l.handle,
      url: canonical,
      description: description,
      image: l.avatar_url || undefined
    }).replace(/</g, '\\u003c') + '</script>' +
    '<style>body{margin:0;background:#0b0b10;color:#f5f5f7;font:16px system-ui,-apple-system,sans-serif}.wrap{max-width:860px;margin:auto;padding:24px 18px 70px}.nav{display:flex;justify-content:space-between;gap:12px;margin-bottom:36px}.nav a{color:#d8b56b;text-decoration:none;font-weight:800}.top{display:flex;gap:18px;align-items:center}.avatar{width:96px;height:96px;border-radius:26px;object-fit:cover;background:#222}.name{font-size:34px;font-weight:900}.handle{opacity:.55}.bio{font-size:18px;line-height:1.5;margin:24px 0}.chips{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.chip{border:1px solid #34343e;border-radius:999px;padding:6px 9px;font-size:11px;color:#aaa}.grid{display:grid;gap:12px}.card{display:flex;flex-direction:column;gap:6px;padding:18px;border:1px solid #292934;border-radius:18px;background:#15151d;color:inherit;text-decoration:none}.card span{opacity:.72}.empty{border:1px dashed #34343e;border-radius:18px;padding:24px;opacity:.7}.brand{margin-top:40px;opacity:.55;font-size:13px}</style></head><body><main class="wrap">' +
    '<nav class="nav"><a href="/">DREAM LEDGER 3000</a><a href="/discover">Discover</a></nav>' +
    '<section class="top">' + avatar + '<div><div class="name">' + esc(l.display_name || l.handle) + '</div><div class="handle">@' + esc(l.handle) + '</div></div></section>' +
    (l.bio ? '<p class="bio">' + esc(l.bio) + '</p>' : '') + '<div class="chips">' + dream + '<div class="chip">Permanent to ' + esc(l.permanence_year || 3000) + '</div><div class="chip">' + esc(followCount || 0) + ' followers</div></div>' +
    (cards ? '<section class="grid">' + cards + '</section>' : '<div class="empty">This Ledger is alive, but nothing has been published yet.</div>') +
    '<div class="brand">Dream Ledger 3000 · Your Ledger. Your World.</div></main></body></html>';
}

function discoverPage(ledgers) {
  const cards = ledgers.map(l =>
    '<a class="card" href="/u/' + encodeURIComponent(l.handle) + '">' +
    '<div class="identity">' + (l.avatar_url ? '<img src="' + esc(l.avatar_url) + '" alt="">' : '<span></span>') +
    '<div><b>' + esc(l.display_name || l.handle) + '</b><small>@' + esc(l.handle) + '</small></div></div>' +
    '<p>' + esc(l.bio || 'A new Dream Ledger.') + '</p></a>'
  ).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Discover | Dream Ledger 3000</title><meta name="description" content="Discover public Dream Ledgers, identities and worlds.">' +
    '<link rel="canonical" href="' + esc(PUBLIC_BASE + '/discover') + '">' +
    '<style>body{margin:0;background:#090b0f;color:#f5f5f7;font:16px system-ui,-apple-system,sans-serif}.wrap{max-width:1100px;margin:auto;padding:24px 16px 70px}.nav{display:flex;justify-content:space-between;margin-bottom:40px}.nav a{color:#d8b56b;text-decoration:none;font-weight:900}.hero h1{font-size:clamp(42px,8vw,80px);line-height:.9;margin:0 0 12px}.muted{color:#8e969e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:28px}.card{display:block;color:inherit;text-decoration:none;border:1px solid #292f36;border-radius:18px;padding:18px;background:#12161b}.identity{display:flex;gap:12px;align-items:center}.identity img,.identity>span{width:58px;height:58px;border-radius:18px;object-fit:cover;background:#252a31}.identity b{display:block;font-size:19px}.identity small{opacity:.5}.card p{color:#9da5ad;line-height:1.45}.brand{margin-top:40px;color:#626b74;font-size:13px}</style></head><body><main class="wrap">' +
    '<nav class="nav"><a href="/">DREAM LEDGER 3000</a><a href="/register">Create yours</a></nav>' +
    '<section class="hero"><h1>Discover worlds.</h1><p class="muted">Public Ledgers are identity surfaces, collections and future storefronts. Browse, share and return.</p></section>' +
    '<section class="grid">' + (cards || '<p class="muted">No public Ledgers yet. Be the first.</p>') + '</section>' +
    '<div class="brand">Dream Ledger 3000 · identity · discovery · commerce · proof</div></main></body></html>';
}

function claimPage(handle) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Claim @' + esc(handle) + ' | Dream Ledger 3000</title><meta name="robots" content="noindex"></head><body style="font:18px system-ui;max-width:640px;margin:80px auto;padding:20px"><h1>@' + esc(handle) + ' is available</h1><p>This Ledger does not exist yet.</p><a href="/register">Create an account</a> · <a href="/create">Claim this handle</a></body></html>';
}

async function readJson(req, maxBytes) {
  let s = '';
  for await (const chunk of req) {
    s += chunk;
    if (s.length > maxBytes) throw new Error('Request too large');
  }
  return JSON.parse(s || '{}');
}

async function handle(req, res, p) {
  if (req.method === 'GET' && p === '/discover') {
    try { return html(res, 200, discoverPage(await getDiscoverLedgers())); }
    catch { return html(res, 503, '<h1>Discovery temporarily unavailable</h1>'); }
  }

  if (req.method === 'GET' && /^\/u\/[A-Za-z0-9-]+\/?$/.test(p)) {
    const raw = p.slice(3).replace(/\/$/, '');
    const h = normalizeHandle(raw);
    if (!validHandle(h)) return html(res, 404, claimPage(h));
    try {
      const l = await getLedger(h);
      if (!l) return html(res, 404, claimPage(h));
      return html(res, 200, Promise.all([getItems(l.id), getFollowCount(l.id)]).then(([it, count]) => page(l, it, count)));
    } catch { return html(res, 503, '<h1>Ledger temporarily unavailable</h1>'); }
  }

  if (req.method === 'GET' && p === '/create') {
    return html(res, 200, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Create your Ledger | Dream Ledger 3000</title><style>body{font:16px system-ui;max-width:680px;margin:40px auto;padding:20px;background:#0b0b10;color:#f5f5f7}input,textarea,button{display:block;width:100%;box-sizing:border-box;margin:10px 0;padding:12px;border-radius:10px;border:1px solid #34343e;background:#15151d;color:inherit}button{cursor:pointer;background:#d8b56b;color:#111;font-weight:900}</style></head><body><h1>Create your Ledger</h1><p>Claim a permanent identity surface. Your Ledger can later hold DreamMeez, links, products, collections, drops, billboards and proof.</p><form id="f"><input name="handle" placeholder="handle" required minlength="3" maxlength="30" pattern="[a-z0-9-]+"><input name="display_name" placeholder="display name"><textarea name="bio" maxlength="500" placeholder="bio"></textarea><button>Create Ledger</button></form><p id="m"></p><script>f.onsubmit=async e=>{e.preventDefault();m.textContent="Creating...";const b=Object.fromEntries(new FormData(f));const r=await fetch("/api/ledgers",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)});const d=await r.json();if(r.ok)location.href=d.url;else m.textContent=d.error||"Unable to create Ledger";}</script><p><a href="/discover" style="color:#d8b56b">Browse Discover</a></p></body></html>');
  }

  if (req.method === 'GET' && p === '/api/ledgers/check') {
    const h = normalizeHandle(new URL(req.url, 'http://localhost').searchParams.get('handle'));
    if (!validHandle(h)) return json(res, 422, { available: false, error: 'Handle must be 3-30 characters using lowercase letters, numbers and hyphens.' });
    try { return json(res, 200, { handle: h, available: !(await getLedger(h)) }); }
    catch { return json(res, 503, { available: false, error: 'Ledger service unavailable' }); }
  }

  if (req.method === 'GET' && /^\/api\/ledgers\/[A-Za-z0-9-]+$/.test(p)) {
    const h = normalizeHandle(p.slice('/api/ledgers/'.length));
    if (!validHandle(h)) return json(res, 404, { error: 'Ledger not found' });
    try {
      const l = await getLedger(h);
      if (!l) return json(res, 404, { error: 'Ledger not found' });
      const it = await getItems(l.id);
      return json(res, 200, { ledger: publicLedger(l), items: it });
    } catch { return json(res, 503, { error: 'Ledger service unavailable' }); }
  }

  if (req.method === 'POST' && /^\\/u\\/[A-Za-z0-9-]+\\/edit$/.test(p)) {
    const u = currentUser(req);
    if (!u) return json(res, 401, { error: 'Log in first.' });
    const h = normalizeHandle(p.split('/')[2]);
    let body;
    try { body = await readJson(req, 100000); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    try {
      const l = await getLedger(h);
      if (!l || l.owner_account_id !== u.id) return json(res, 403, { error: 'Ledger not found or not owned by you.' });
      const patch = {
        display_name: body.display_name === undefined ? l.display_name : String(body.display_name || '').trim().slice(0, 80) || l.display_name,
        bio: body.bio === undefined ? l.bio : String(body.bio || '').trim().slice(0, 500),
        avatar_url: body.avatar_url === undefined ? l.avatar_url : (body.avatar_url ? String(body.avatar_url).trim().slice(0, 2000) : null),
        dreammeez_id: body.dreammeez_id === undefined ? l.dreammeez_id : (body.dreammeez_id ? String(body.dreammeez_id).trim().slice(0, 120) : null),
        theme: body.theme === undefined ? l.theme : String(body.theme || 'default').trim().slice(0, 40)
      };
      const updated = await supabase('dream_ledgers?id=eq.' + encodeURIComponent(l.id), { method: 'PATCH', body: JSON.stringify(patch) });
      return json(res, 200, { ok: true, ledger: Array.isArray(updated) ? updated[0] : updated, url: '/u/' + h });
    } catch { return json(res, 503, { error: 'Ledger service unavailable' }); }
  }

  if ((req.method === 'POST' || req.method === 'DELETE') && p === '/api/follow') {
    const u = currentUser(req);
    if (!u) return json(res, 401, { error: 'Log in first.' });
    let body;
    try { body = await readJson(req, 10000); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    const h = normalizeHandle(body.handle);
    try {
      const l = await getLedger(h);
      if (!l) return json(res, 404, { error: 'Ledger not found.' });
      const resource = 'dream_ledger_follows?ledger_id=eq.' + encodeURIComponent(l.id) + '&follower_account_id=eq.' + encodeURIComponent(u.id);
      if (req.method === 'DELETE') {
        await supabase(resource, { method: 'DELETE' });
      } else {
        await supabase('dream_ledger_follows', { method: 'POST', body: JSON.stringify({ ledger_id: l.id, follower_account_id: u.id }) });
      }
      return json(res, 200, { ok: true, following: req.method !== 'DELETE', follow_count: await getFollowCount(l.id) });
    } catch (e) {
      if (e.status === 409) return json(res, 200, { ok: true, following: true, follow_count: await getFollowCount(l.id) });
      return json(res, 503, { error: 'Follow service unavailable' });
    }
  }

  if (req.method === 'GET' && /^\\/u\\/[A-Za-z0-9-]+\\/qr\\.png$/.test(p)) {
    const h = normalizeHandle(p.split('/')[2]);
    if (!validHandle(h)) return sendBinary(res, 404, Buffer.from('not found'));
    try {
      const l = await getLedger(h);
      if (!l) return sendBinary(res, 404, Buffer.from('not found'));
      const png = await QRCode.toBuffer(PUBLIC_BASE + '/u/' + encodeURIComponent(h), { type: 'png', width: 640, margin: 2 });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      return res.end(png);
    } catch { return sendBinary(res, 503, Buffer.from('qr unavailable')); }
  }

  if (req.method === 'POST' && p === '/api/ledgers') {
    const u = currentUser(req);
    if (!u) return json(res, 401, { error: 'Log in first to create a Ledger.' });
    let body;
    try { body = await readJson(req, 100000); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    const h = normalizeHandle(body.handle);
    if (!validHandle(h)) return json(res, 422, { error: 'Handle must be 3-30 characters using lowercase letters, numbers and hyphens.' });
    const display = String(body.display_name || h).trim().slice(0, 80) || h;
    const bio = String(body.bio || '').trim().slice(0, 500);
    try {
      if (await getLedger(h)) return json(res, 409, { error: 'That handle is already claimed.' });
      const row = {
        id: crypto.randomUUID(),
        owner_account_id: u.id,
        handle: h,
        display_name: display,
        bio,
        avatar_url: null,
        dreammeez_id: null,
        theme: 'default',
        permanence_year: 3000,
        status: 'active'
      };
      const created = await supabase('dream_ledgers', { method: 'POST', body: JSON.stringify(row) });
      return json(res, 201, { ok: true, ledger: Array.isArray(created) ? created[0] : created, url: '/u/' + h });
    } catch (e) {
      if (e.status === 409) return json(res, 409, { error: 'That handle is already claimed.' });
      return json(res, 503, { error: 'Ledger service unavailable' });
    }
  }

  if (req.method === 'POST' && /^\/api\/ledgers\/[A-Za-z0-9-]+\/items$/.test(p)) {
    const u = currentUser(req);
    if (!u) return json(res, 401, { error: 'Log in first.' });
    const h = normalizeHandle(p.split('/')[3]);
    let body;
    try { body = await readJson(req, 100000); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    if (!validItemType(body.item_type)) return json(res, 422, { error: 'Invalid item type.' });
    const l = await getLedger(h);
    if (!l || l.owner_account_id !== u.id) return json(res, 403, { error: 'Ledger not found or not owned by you.' });
    const title = String(body.title || '').trim().slice(0, 120);
    if (!title) return json(res, 422, { error: 'Title is required.' });
    const row = {
      id: crypto.randomUUID(),
      ledger_id: l.id,
      item_type: body.item_type,
      title,
      body: String(body.body || '').trim().slice(0, 2000),
      target: String(body.target || '').trim().slice(0, 2000) || null,
      position: Number.isFinite(Number(body.position)) ? Number(body.position) : 0,
      published: body.published !== false
    };
    try {
      const created = await supabase('dream_ledger_items', { method: 'POST', body: JSON.stringify(row) });
      return json(res, 201, { ok: true, item: Array.isArray(created) ? created[0] : created, url: '/u/' + h });
    } catch { return json(res, 503, { error: 'Ledger item service unavailable' }); }
  }

  return false;
}

module.exports = { handle };
