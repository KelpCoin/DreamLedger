'use strict';
const { DatabaseSync } = require('node:sqlite');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const Ajv = require('ajv');
const fs = require('node:fs');
const path = require('node:path');
const money = { type: 'integer', minimum: 1, maximum: 100000000 };
const validate = new Ajv({ allErrors: true }).compile({
  type: 'object', additionalProperties: false,
  required: ['inventory_id', 'category', 'title', 'description', 'start_minor', 'increment_minor', 'starts_at', 'ends_at'],
  properties: {
    inventory_id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,100}$' },
    category: { enum: ['mtg', 'vinyl', 'cd', 'cassette', 'dvd', 'book', 'clothing', 'collectibles'] },
    title: { type: 'string', minLength: 3, maxLength: 160 },
    description: { type: 'string', minLength: 1, maxLength: 5000 },
    start_minor: money, increment_minor: money, reserve_minor: money,
    starts_at: { type: 'integer', minimum: 0 }, ends_at: { type: 'integer', minimum: 0 },
    metadata: { type: 'object', maxProperties: 30 }
  }
});
function fail(code, status = 409) { throw Object.assign(new Error(code), { statusCode: status }); }
function identity(id) { if (typeof id !== 'string' || !/^[A-Za-z0-9_:-]{1,128}$/.test(id)) fail('AUTHENTICATION_REQUIRED', 401); }
function key(k) { if (typeof k !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(k)) fail('IDEMPOTENCY_KEY_REQUIRED', 400); }
function canonical(value) { return JSON.stringify(value, Object.keys(value).sort()); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
class AuctionStore {
  constructor(filename, clock = Date.now) {
    if (!filename) fail('AUCTION_DATABASE_NOT_CONFIGURED', 503);
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    this.clock = clock;
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS auction_lots (
        id TEXT PRIMARY KEY, seller TEXT NOT NULL, inventory_id TEXT NOT NULL, category TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL, metadata TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'NZD',
        start_minor INTEGER NOT NULL CHECK(start_minor>0), increment_minor INTEGER NOT NULL CHECK(increment_minor>0),
        reserve_minor INTEGER NOT NULL, current_minor INTEGER, leader TEXT,
        starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, original_end INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('draft','open','awaiting_payment','unsold','cancelled')),
        approved_by TEXT, created_at INTEGER NOT NULL, CHECK(ends_at>starts_at));
      CREATE UNIQUE INDEX IF NOT EXISTS auction_stock_lock ON auction_lots(seller,inventory_id)
        WHERE status IN ('draft','open','awaiting_payment');
      CREATE TABLE IF NOT EXISTS auction_bids (
        id TEXT PRIMARY KEY, auction_id TEXT NOT NULL REFERENCES auction_lots(id), bidder TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK(amount_minor>0), created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS auction_bid_history ON auction_bids(auction_id,created_at);
      CREATE TABLE IF NOT EXISTS auction_requests (
        principal TEXT NOT NULL, operation TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
        response TEXT NOT NULL, PRIMARY KEY(principal,operation,request_key));
      CREATE TABLE IF NOT EXISTS auction_orders (
        id TEXT PRIMARY KEY, auction_id TEXT NOT NULL UNIQUE REFERENCES auction_lots(id), buyer TEXT NOT NULL,
        seller TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'NZD',
        platform_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(platform_fee_minor=0), status TEXT NOT NULL DEFAULT 'payment_pending');
      CREATE TABLE IF NOT EXISTS auction_sessions (token_hash TEXT PRIMARY KEY, principal TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auction_login_limits (bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL);`);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); this.db.exec('COMMIT'); return r; }
    catch (e) { this.db.exec('ROLLBACK'); if (e.code?.startsWith('ERR_SQLITE') && /UNIQUE/.test(e.message)) fail('INVENTORY_ALREADY_ALLOCATED'); throw e; }
  }
  once(principal, operation, requestKey, fingerprint, fn) {
    identity(principal); key(requestKey);
    return this.transaction(() => {
      const old = this.db.prepare('SELECT * FROM auction_requests WHERE principal=? AND operation=? AND request_key=?').get(principal, operation, requestKey);
      if (old) { if (old.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT'); return JSON.parse(old.response); }
      const result = fn();
      this.db.prepare('INSERT INTO auction_requests VALUES(?,?,?,?,?)').run(principal, operation, requestKey, fingerprint, JSON.stringify(result));
      return result;
    });
  }
  create(seller, input, requestKey) {
    if (!validate(input) || !input.title.trim() || !input.description.trim()) fail('INVALID_LISTING', 400);
    const now = this.clock();
    if (input.ends_at <= now || input.ends_at <= input.starts_at || input.ends_at - input.starts_at > 30 * 86400000 || input.ends_at > now + 60 * 86400000) fail('INVALID_AUCTION_WINDOW', 400);
    if (input.reserve_minor != null && input.reserve_minor < input.start_minor) fail('INVALID_RESERVE', 400);
    return this.once(seller, 'create', requestKey, digest(JSON.stringify(input)), () => {
      const id = randomUUID();
      this.db.prepare(`INSERT INTO auction_lots(id,seller,inventory_id,category,title,description,metadata,start_minor,increment_minor,reserve_minor,starts_at,ends_at,original_end,status,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)`).run(id, seller, input.inventory_id, input.category, input.title.trim(), input.description, JSON.stringify(input.metadata || {}), input.start_minor, input.increment_minor, input.reserve_minor || 0, input.starts_at, input.ends_at, input.ends_at, now);
      return { auction_id: id, status: 'draft', platform_fee_minor: 0 };
    });
  }
  row(id) { const row = this.db.prepare('SELECT * FROM auction_lots WHERE id=?').get(id); if (!row) fail('AUCTION_NOT_FOUND', 404); return row; }
  approve(id, reviewer) {
    identity(reviewer);
    return this.transaction(() => {
      const a = this.row(id);
      if (a.status !== 'draft' || a.ends_at <= this.clock()) fail('NOT_APPROVABLE');
      this.db.prepare("UPDATE auction_lots SET status='open',approved_by=? WHERE id=?").run(reviewer, id);
      return { auction_id: id, status: 'open' };
    });
  }
  bid(id, bidder, amount, requestKey) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) fail('INVALID_AMOUNT_MINOR', 400);
    return this.once(bidder, 'bid', requestKey, canonical({ id, amount }), () => {
      const a = this.row(id), now = this.clock();
      if (a.seller === bidder) fail('SELF_BID_FORBIDDEN', 403);
      if (a.status !== 'open' || !a.approved_by || now < a.starts_at || now >= a.ends_at) fail('AUCTION_NOT_OPEN');
      const minimum = a.current_minor === null ? a.start_minor : a.current_minor + a.increment_minor;
      if (amount < minimum) fail('BID_BELOW_MINIMUM');
      const bidId = randomUUID();
      const end = a.ends_at - now <= 120000 ? Math.min(now + 120000, a.original_end + 3600000) : a.ends_at;
      this.db.prepare('INSERT INTO auction_bids VALUES(?,?,?,?,?)').run(bidId, id, bidder, amount, now);
      this.db.prepare('UPDATE auction_lots SET current_minor=?,leader=?,ends_at=? WHERE id=?').run(amount, bidder, end, id);
      return { bid_id: bidId, auction_id: id, amount_minor: amount, ends_at: end, status: 'accepted', payment_status: 'not_charged' };
    });
  }
  closeAuction(id) {
    return this.transaction(() => {
      const a = this.row(id);
      if (a.status === 'awaiting_payment' || a.status === 'unsold') return { auction_id: id, status: a.status };
      if (a.status !== 'open' || this.clock() < a.ends_at) fail('AUCTION_NOT_ENDED');
      const won = a.leader && a.current_minor >= a.reserve_minor;
      const status = won ? 'awaiting_payment' : 'unsold';
      if (won) this.db.prepare('INSERT INTO auction_orders(id,auction_id,buyer,seller,amount_minor) VALUES(?,?,?,?,?)').run(randomUUID(), id, a.leader, a.seller, a.current_minor);
      this.db.prepare('UPDATE auction_lots SET status=? WHERE id=?').run(status, id);
      return { auction_id: id, status };
    });
  }
  cancel(id, seller) {
    identity(seller);
    return this.transaction(() => {
      const a = this.row(id);
      if (a.seller !== seller) fail('FORBIDDEN', 403);
      if (!['draft', 'open'].includes(a.status) || a.current_minor !== null) fail('CANNOT_CANCEL');
      this.db.prepare("UPDATE auction_lots SET status='cancelled' WHERE id=?").run(id);
      return { auction_id: id, status: 'cancelled' };
    });
  }
  view(a) {
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM auction_bids WHERE auction_id=?').get(a.id).n;
    return { auction_id: a.id, category: a.category, title: a.title, description: a.description, metadata: JSON.parse(a.metadata), currency: a.currency,
      start_minor: a.start_minor, current_minor: a.current_minor, minimum_bid_minor: a.current_minor === null ? a.start_minor : a.current_minor + a.increment_minor,
      starts_at: a.starts_at, ends_at: a.ends_at, bid_count: count, status: a.status === 'open' && this.clock() >= a.ends_at ? 'ended' : a.status,
      reserve_met: a.current_minor !== null && a.current_minor >= a.reserve_minor, platform_fee_minor: 0, checkout_available: false };
  }
  list({ category = '', q = '', seller = null } = {}) {
    // Fixed category allowlist prevents adult-silo discovery through this adapter.
    return this.db.prepare(`SELECT * FROM auction_lots WHERE ${seller ? 'seller=?' : "approved_by IS NOT NULL AND status IN ('open','awaiting_payment','unsold')"}
      AND (?='' OR category=?) AND (title LIKE ? OR description LIKE ?) ORDER BY ends_at LIMIT 100`)
      .all(...(seller ? [seller] : []), category, category, '%' + q.slice(0,100) + '%', '%' + q.slice(0,100) + '%').map(a => this.view(a));
  }
  get(id, principal) { const a = this.row(id); if (!a.approved_by && a.seller !== principal) fail('AUCTION_NOT_FOUND', 404); return this.view(a); }
  orders(principal) { identity(principal); return this.db.prepare('SELECT * FROM auction_orders WHERE buyer=? OR seller=?').all(principal, principal); }
  session(principal) {
    identity(principal); const token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO auction_sessions VALUES(?,?,?)').run(digest(token), principal, this.clock() + 3600000);
    return token;
  }
  authenticate(token) { return this.db.prepare('SELECT principal FROM auction_sessions WHERE token_hash=? AND expires_at>?').get(digest(token || ''), this.clock())?.principal || null; }
  logout(token) { this.db.prepare('DELETE FROM auction_sessions WHERE token_hash=?').run(digest(token || '')); }
  allowLogin(bucket) {
    return this.transaction(() => {
      const now = this.clock(), b = digest(bucket);
      this.db.prepare('DELETE FROM auction_login_limits WHERE window_start<?').run(now - 900000);
      const r = this.db.prepare('SELECT attempts FROM auction_login_limits WHERE bucket=?').get(b);
      if (r?.attempts >= 10) return false;
      this.db.prepare('INSERT INTO auction_login_limits VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1').run(b, now);
      return true;
    });
  }
  close() { this.db.close(); }
}
module.exports = { AuctionStore, fail };
