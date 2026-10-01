'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const LISTINGS = path.join(DATA_ROOT, 'mtg-marketplace-listings.json');
const REQUESTS = path.join(DATA_ROOT, 'mtg-marketplace-requests.json');
const USERS = path.join(DATA_ROOT, 'users.json');
const COOKIE = 'dreamiez_session';

function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1000000) throw new Error('Request too large');
  }
  return JSON.parse(raw || '{}');
}
function cookie(req) {
  const raw = String(req.headers.cookie || '');
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function currentUser(req) {
  const sid = cookie(req);
  if (!sid) return null;
  const users = read(USERS, []);
  return users.find(u => u.id === sid && u.email) || null;
}
function clean(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function bool(v) { return v === true || v === 'true' || v === 'on' || v === 1 || v === '1'; }
function ip(req) {
  return clean(String(req.headers['true-client-ip'] || req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || ''), 128);
}
function safeListing(x) {
  return {
    id: x.id, title: x.title, set_name: x.set_name, collector_number: x.collector_number,
    condition: x.condition, language: x.language, image_url: x.image_url, description: x.description,
    price_nzd: x.price_nzd, accepts_buy: x.accepts_buy, accepts_trade: x.accepts_trade,
    trade_wanted: x.trade_wanted, status: x.status, seller_id: x.seller_id,
    seller_display_name: x.seller_display_name, trader_status: x.trader_status,
    created_at: x.created_at, updated_at: x.updated_at
  };
}
function sellerRecord(user, req, input) {
  const seller = user.seller || {};
  const trader = String(input.trader_status || '').toLowerCase();
  if (!['trader','private'].includes(trader)) throw Object.assign(new Error('Choose whether you are selling in trade or as a private seller.'), { statusCode: 422 });
  const address = clean(input.contact_address || seller.location, 300);
  if (!address) throw Object.assign(new Error('Contact address is required for a physical MTG listing.'), { statusCode: 422 });
  return {
    legal_name: clean(input.legal_name || user.name, 120),
    contact_address: address,
    online_trading_identity: clean(input.online_trading_identity || seller.display_name || user.name, 120),
    trader_status: trader,
    ip_address: ip(req)
  };
}
async function handle(req, res, url) {
  const route = String(url || req.url || '').split('?')[0];
  if (!route.startsWith('/api/mtg/marketplace')) return false;

  if (req.method === 'GET' && route === '/api/mtg/marketplace/listings') {
    const listings = read(LISTINGS, []).filter(x => x.status === 'active').map(safeListing);
    const user = currentUser(req);
    const mine = user ? read(LISTINGS, []).filter(x => x.seller_id === user.id).map(safeListing) : [];
    const requests = user ? read(REQUESTS, []).filter(x => x.buyer_id === user.id || x.seller_id === user.id).map(x => ({
      id:x.id, listing_id:x.listing_id, type:x.type, status:x.status, offered_amount_nzd:x.offered_amount_nzd,
      trade_offer:x.trade_offer, buyer_id:x.buyer_id, seller_id:x.seller_id, created_at:x.created_at, updated_at:x.updated_at
    })) : [];
    return json(res, 200, { fee_policy: 'MTG_ZERO_FEE', listings, mine, requests });
  }

  if (req.method === 'POST' && route === '/api/mtg/marketplace/list') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Log in before listing a card.' });
    const input = await body(req);
    const title = clean(input.title, 160);
    const price = Number(input.price_nzd);
    const acceptsBuy = bool(input.accepts_buy);
    const acceptsTrade = bool(input.accepts_trade);
    if (!title) return json(res, 422, { error: 'Card name is required.' });
    if (!acceptsBuy && !acceptsTrade) return json(res, 422, { error: 'Choose buy, trade, or both.' });
    if (acceptsBuy && (!Number.isFinite(price) || price <= 0)) return json(res, 422, { error: 'Enter a valid NZD price when accepting buys.' });
    let compliance;
    try { compliance = sellerRecord(user, req, input); } catch (err) { return json(res, err.statusCode || 422, { error: err.message }); }
    const now = new Date().toISOString();
    const listing = {
      id: 'mtg_' + crypto.randomBytes(10).toString('hex'),
      seller_id: user.id,
      seller_display_name: clean(user.seller?.display_name || user.name, 80),
      title,
      set_name: clean(input.set_name, 120),
      collector_number: clean(input.collector_number, 40),
      condition: clean(input.condition || 'Unspecified', 40),
      language: clean(input.language || 'English', 40),
      image_url: clean(input.image_url, 1000),
      description: clean(input.description, 1500),
      price_nzd: acceptsBuy ? Math.round(price * 100) / 100 : null,
      accepts_buy: acceptsBuy,
      accepts_trade: acceptsTrade,
      trade_wanted: clean(input.trade_wanted, 800),
      trader_status: compliance.trader_status,
      status: 'active',
      created_at: now,
      updated_at: now,
      seller_compliance: {
        legal_name: compliance.legal_name,
        contact_address: compliance.contact_address,
        online_trading_identity: compliance.online_trading_identity,
        trader_status: compliance.trader_status,
        captured_ip: compliance.ip_address,
        captured_at: now
      }
    };
    const listings = read(LISTINGS, []);
    listings.push(listing);
    write(LISTINGS, listings);
    return json(res, 201, { ok: true, listing: safeListing(listing), fee_nzd: 0, fee_policy: 'MTG_ZERO_FEE' });
  }

  if (req.method === 'POST' && route === '/api/mtg/marketplace/request') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Log in before making an offer.' });
    const input = await body(req);
    const listings = read(LISTINGS, []);
    const listing = listings.find(x => x.id === clean(input.listing_id, 80) && x.status === 'active');
    if (!listing) return json(res, 404, { error: 'Listing not found.' });
    if (listing.seller_id === user.id) return json(res, 409, { error: 'You cannot buy or trade your own listing.' });
    const type = String(input.type || '').toLowerCase();
    if (!['buy','trade'].includes(type)) return json(res, 422, { error: 'Offer type must be buy or trade.' });
    if (type === 'buy' && !listing.accepts_buy) return json(res, 409, { error: 'This seller is not accepting a buy offer.' });
    if (type === 'trade' && !listing.accepts_trade) return json(res, 409, { error: 'This seller is not accepting trades.' });
    const amount = type === 'buy' ? Number(input.offered_amount_nzd || listing.price_nzd) : null;
    if (type === 'buy' && (!Number.isFinite(amount) || amount <= 0)) return json(res, 422, { error: 'Enter a valid NZD offer.' });
    const now = new Date().toISOString();
    const request = {
      id: 'req_' + crypto.randomBytes(10).toString('hex'),
      listing_id: listing.id,
      type,
      status: 'pending_seller_acceptance',
      buyer_id: user.id,
      buyer_display_name: clean(user.seller?.display_name || user.name, 80),
      seller_id: listing.seller_id,
      offered_amount_nzd: type === 'buy' ? Math.round(amount * 100) / 100 : null,
      trade_offer: type === 'trade' ? clean(input.trade_offer, 1500) : null,
      created_at: now,
      updated_at: now
    };
    const requests = read(REQUESTS, []);
    requests.push(request);
    write(REQUESTS, requests);
    return json(res, 201, {
      ok: true,
      request: { id: request.id, status: request.status, type: request.type, listing_id: request.listing_id },
      fee_nzd: 0,
      economic_state: 'UNSETTLED_REQUEST'
    });
  }

  if (req.method === 'POST' && route === '/api/mtg/marketplace/request/decision') {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Log in before responding to an offer.' });
    const input = await body(req);
    const requests = read(REQUESTS, []);
    const request = requests.find(x => x.id === clean(input.request_id, 80));
    if (!request) return json(res, 404, { error: 'Offer not found.' });
    if (request.seller_id !== user.id) return json(res, 403, { error: 'Only the seller can accept or decline this offer.' });
    const decision = String(input.decision || '').toLowerCase();
    if (!['accept','decline'].includes(decision)) return json(res, 422, { error: 'Decision must be accept or decline.' });
    request.status = decision === 'accept' ? 'accepted_direct_contract_pending_settlement' : 'declined';
    request.updated_at = new Date().toISOString();
    write(REQUESTS, requests);
    return json(res, 200, {
      ok: true,
      request: { id: request.id, status: request.status },
      next_step: decision === 'accept' ? 'Buyer and seller complete their direct sale/trade. No DreamLedger fee or payment is taken by this MVP.' : 'No transaction created.'
    });
  }

  return false;
}
module.exports = { handle };
