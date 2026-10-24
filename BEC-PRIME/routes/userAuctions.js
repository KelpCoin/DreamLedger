'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
function fail(code, status = 409) { throw Object.assign(new Error(code), { statusCode: status }); }
function send(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value)); return true;
}
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 32000) fail('REQUEST_TOO_LARGE', 413); }
  try { const v = JSON.parse(text || '{}'); if (!v || Array.isArray(v) || typeof v !== 'object') throw Error(); return v; }
  catch { fail('INVALID_JSON', 400); }
}
function createHandler({ store, usersFile, reviewers = [], origin = 'https://dreamledger.org' }) {
  return async function handle(req, res, route) {
    if (!(route === '/api/auctions' || route.startsWith('/api/auctions/'))) return false;
    try {
      const url = new URL(req.url, origin);
      const token = /^Bearer ([a-f0-9]{64})$/.exec(String(req.headers.authorization || ''))?.[1] || '';
      const principal = store.authenticate(token);
      const isReviewer = principal && reviewers.includes(principal);
      if (req.method === 'GET' && route === '/api/auctions') return send(res, 200, { auctions: store.list({ category: url.searchParams.get('category') || '', q: url.searchParams.get('q') || '' }) });
      if (req.method !== 'GET') {
        // Browsers must be same-origin; bearer-only agents need no Origin header.
        if (req.headers.origin && req.headers.origin !== new URL(origin).origin) fail('ORIGIN_FORBIDDEN', 403);
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) fail('JSON_REQUIRED', 415);
      }
      if (req.method === 'POST' && route === '/api/auctions/session') {
        const b = await body(req);
        const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
        if (typeof b.password !== 'string' || b.password.length > 256 || email.length > 254) fail('INVALID_CREDENTIALS', 401);
        // Never trust forwarded IP headers supplied by an untrusted caller.
        if (!store.allowLogin('ip:' + req.socket.remoteAddress) || !store.allowLogin('email:' + email)) fail('LOGIN_RATE_LIMITED', 429);
        let users; try { users = JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { fail('ACCOUNT_STORE_UNAVAILABLE', 503); }
        const user = Array.isArray(users) ? users.find(u => String(u.email).toLowerCase() === email) : null;
        const record = user?.password;
        const validRecord = record && /^[a-f0-9]{32}$/.test(record.salt) && /^[a-f0-9]{128}$/.test(record.hash);
        const hash = await scrypt(b.password, validRecord ? record.salt : '00000000000000000000000000000000', 64);
        const expected = Buffer.from(validRecord ? record.hash : '00'.repeat(64), 'hex');
        if (!crypto.timingSafeEqual(hash, expected) || !validRecord) fail('INVALID_CREDENTIALS', 401);
        return send(res, 200, { token: store.session(user.id), expires_in: 3600, reviewer: reviewers.includes(user.id) });
      }
      if (req.method === 'GET' && /^\/api\/auctions\/[a-f0-9-]{36}$/.test(route)) return send(res, 200, store.get(route.split('/')[3], principal));
      if (!principal) fail('AUTHENTICATION_REQUIRED', 401);
      if (req.method === 'GET' && route === '/api/auctions/mine') return send(res, 200, { auctions: store.list({ seller: principal }), orders: store.orders(principal) });
      if (req.method === 'POST' && route === '/api/auctions/logout') { store.logout(token); return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && route === '/api/auctions') return send(res, 201, store.create(principal, await body(req), req.headers['idempotency-key']));
      const match = /^\/api\/auctions\/([a-f0-9-]{36})\/(bids|approve|close|cancel)$/.exec(route);
      if (req.method === 'POST' && match) {
        const [, id, action] = match, b = await body(req);
        if (action === 'bids') {
          if (Object.keys(b).some(k => k !== 'amount_minor')) fail('UNEXPECTED_BID_FIELDS', 400);
          return send(res, 200, store.bid(id, principal, b.amount_minor, req.headers['idempotency-key']));
        }
        if (action === 'approve') { if (!isReviewer) fail('REVIEWER_REQUIRED', 403); return send(res, 200, store.approve(id, principal)); }
        if (action === 'cancel') return send(res, 200, store.cancel(id, principal));
        return send(res, 200, store.closeAuction(id));
      }
      return send(res, 404, { error: 'AUCTION_ROUTE_NOT_FOUND' });
    } catch (e) { return send(res, e.statusCode || 503, { error: e.statusCode ? e.message : 'AUCTION_SERVICE_UNAVAILABLE' }); }
  };
}
let handler;
async function handle(req, res, route) {
  if (!(route === '/api/auctions' || route.startsWith('/api/auctions/'))) return false;
  if (process.env.USER_AUCTIONS_ENABLED !== '1' || !process.env.AUCTION_SQLITE_PATH) return send(res, 503, { error: 'USER_AUCTIONS_NOT_ENABLED', auctions: [] });
  try {
    if (!handler) {
      const root = process.env.DREAMIEZ_DATA_DIR || (fs.existsSync('/var/data') ? '/var/data/dreamiez' : path.join(__dirname, '../data/dreamiez'));
      handler = createHandler({ store: new (require('../marketplace/auction-store').AuctionStore)(process.env.AUCTION_SQLITE_PATH), usersFile: path.join(root, 'users.json'),
        reviewers: String(process.env.AUCTION_REVIEWER_IDS || '').split(',').filter(Boolean), origin: process.env.PUBLIC_BASE_URL || 'https://dreamledger.org' });
    }
    return handler(req, res, route);
  } catch { return send(res, 503, { error: 'AUCTION_SERVICE_UNAVAILABLE' }); }
}
module.exports = { handle, createHandler };
