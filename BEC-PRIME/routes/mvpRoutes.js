'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const stripeProof = require('../lib/stripeWebhookProof');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'catalog', 'products');
const COOKIE = 'dreamiez_session';
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');

function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}
function getCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}
async function body(req, limit = 5000000) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new Error('Request too large');
  }
  try { return { raw, value: JSON.parse(raw || '{}') }; }
  catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
}
function dbConfig() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('Supabase persistence is not configured');
  return { base, key };
}
async function db(method, table, query = '', payload, prefer = 'return=representation') {
  const cfg = dbConfig();
  const response = await fetch(cfg.base + '/rest/v1/' + table + query, {
    method,
    headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json', Prefer: prefer },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw Object.assign(new Error('Supabase ' + table + ' request failed (' + response.status + ')'), { statusCode: 502, detail: data });
  return data;
}
async function principal(req) {
  const id = getCookie(req, COOKIE);
  if (!id) return null;
  const rows = await db('GET', 'dreamledger_accounts', '?select=id,email,name&id=eq.' + encodeURIComponent(id) + '&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
function cleanQuery(value) { return String(value || '').replace(/[^A-Za-z0-9_:-]/g, ''); }
function product(productId) {
  const id = cleanQuery(productId);
  if (!id) return null;
  const file = path.join(CATALOG, id + '.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function checkoutableProduct(productId) {
  const p = product(productId);
  if (!p || p.status !== 'published' || p.commercial_truth?.approval_required !== false || Number(p.inventory || 0) < 1) return null;
  return p;
}
function form(params) { const out = new URLSearchParams(); for (const [key, value] of Object.entries(params)) out.set(key, String(value)); return out; }
async function stripe(endpoint, params, idempotencyKey) {
  const secret = String(process.env.STRIPE_SECRET_KEY || '');
  if (!secret) throw Object.assign(new Error('STRIPE_SECRET_KEY is not configured'), { statusCode: 503 });
  const response = await fetch('https://api.stripe.com/v1/' + endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey }, body: form(params) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Stripe API request failed'), { statusCode: 502 });
  return data;
}
async function appendEvidence({ principalId, agentId, action, authority, outcome, eventId }) {
  const timestamp = new Date().toISOString();
  const rpc = await db('POST', 'rpc/dreamledger_append_evidence', '', { p_event_id: eventId, p_timestamp: timestamp, p_principal_id: principalId || null, p_agent_id: agentId || null, p_action: action, p_authority: authority || null, p_outcome: outcome }, 'return=representation');
  return Array.isArray(rpc) ? rpc[0] : rpc;
}
async function createCheckout(req, res) {
  const user = await principal(req);
  if (!user) return json(res, 401, { error: 'Authentication required' });
  const parsed = await body(req, 100000);
  const requested = parsed.value.offer_id || parsed.value.product_id || parsed.value.sku;
  const p = checkoutableProduct(requested);
  if (!p) return json(res, 403, { error: 'Product is not approved and checkoutable' });
  const session = await stripe('checkout/sessions', {
    mode: 'payment',
    'success_url': PUBLIC_BASE + '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
    'cancel_url': PUBLIC_BASE + '/?checkout_cancelled=1',
    'line_items[0][price_data][currency]': String(p.currency || 'nzd').toLowerCase(),
    'line_items[0][price_data][unit_amount]': Number(p.price),
    'line_items[0][price_data][product_data][name]': p.name,
    'line_items[0][price_data][product_data][metadata][product_id]': p.id,
    'line_items[0][quantity]': 1,
    'metadata[account_id]': user.id,
    'metadata[product_id]': p.id,
    'metadata[silo]': p.silo || 'dreamledger',
    'metadata[commerce_version]': 'dreamledger-mvp-v1'
  }, 'dreamledger-mvp-checkout-' + user.id + '-' + p.id + '-' + crypto.randomUUID());
  await db('POST', 'dreamledger_orders', '', { id: 'ord_' + crypto.randomBytes(12).toString('hex'), principal_id: user.id, checkout_session_id: session.id, product_id: p.id, amount_total: Number(p.price), currency: String(p.currency || 'nzd').toLowerCase(), payment_status: 'pending', customer_email: user.email }, 'return=minimal');
  return json(res, 200, { ok: true, order_pending: true, session_id: session.id, checkout_url: session.url, amount_minor: Number(p.price), currency: String(p.currency || 'nzd').toLowerCase() });
}
async function stripeWebhook(req, res) {
  const parsed = await body(req, 5000000);
  stripeProof.verifyStripeSignature(parsed.raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET || '');
  const event = parsed.value;
  if (event.type !== 'checkout.session.completed') return json(res, 200, { received: true, ignored: true });
  const session = event?.data?.object;
  if (!session || session.payment_status !== 'paid') return json(res, 200, { received: true, ignored: true, reason: 'payment_not_paid' });
  const accountId = cleanQuery(session.metadata?.account_id);
  const productId = cleanQuery(session.metadata?.product_id);
  const p = checkoutableProduct(productId);
  if (!accountId || !p || String(session.currency).toLowerCase() !== String(p.currency || 'nzd').toLowerCase() || Number(session.amount_total) !== Number(p.price)) return json(res, 400, { error: 'Payment failed canonical server-side validation' });
  const existing = await db('GET', 'dreamledger_orders', '?select=*&checkout_session_id=eq.' + encodeURIComponent(session.id) + '&limit=1');
  let order = Array.isArray(existing) && existing[0] ? existing[0] : null;
  if (!order) {
    const rows = await db('POST', 'dreamledger_orders', '', { id: 'ord_' + crypto.randomBytes(12).toString('hex'), principal_id: accountId, checkout_session_id: session.id, product_id: p.id, amount_total: Number(session.amount_total), currency: String(session.currency).toLowerCase(), payment_status: 'paid', stripe_payment_intent: session.payment_intent || null, customer_email: session.customer_details?.email || null, paid_at: new Date().toISOString() });
    order = Array.isArray(rows) ? rows[0] : rows;
  } else if (order.payment_status !== 'paid') {
    const rows = await db('PATCH', 'dreamledger_orders', '?id=eq.' + encodeURIComponent(order.id), { payment_status: 'paid', stripe_payment_intent: session.payment_intent || null, paid_at: new Date().toISOString() });
    order = Array.isArray(rows) ? rows[0] : order;
  }
  const evidence = await appendEvidence({ principalId: accountId, action: 'STRIPE_PAYMENT', authority: { source: 'stripe_webhook', checkout_session_id: session.id }, outcome: { allowed: true, status: 'PAID', order_id: order.id, amount_total: Number(session.amount_total), currency: String(session.currency).toLowerCase(), product_id: p.id }, eventId: 'stripe_' + event.id });
  return json(res, 200, { received: true, order_id: order.id, evidence_event_id: evidence?.event_id || ('stripe_' + event.id) });
}
async function getOrders(req, res) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  const rows = await db('GET', 'dreamledger_orders', '?select=id,checkout_session_id,product_id,amount_total,currency,payment_status,created_at,paid_at&principal_id=eq.' + encodeURIComponent(user.id) + '&order=created_at.desc');
  return json(res, 200, { orders: rows || [] });
}
async function getOrder(req, res, id) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  const rows = await db('GET', 'dreamledger_orders', '?select=*&id=eq.' + encodeURIComponent(cleanQuery(id)) + '&principal_id=eq.' + encodeURIComponent(user.id) + '&limit=1');
  if (!Array.isArray(rows) || !rows[0]) return json(res, 404, { error: 'Order not found' });
  return json(res, 200, rows[0]);
}
async function getOrderProof(req, res, id) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  const orders = await db('GET', 'dreamledger_orders', '?select=id,principal_id&id=eq.' + encodeURIComponent(cleanQuery(id)) + '&limit=1');
  if (!orders?.[0] || orders[0].principal_id !== user.id) return json(res, 404, { error: 'Order not found' });
  const eventRows = await db('GET', 'dreamledger_evidence', '?select=*&action=eq.STRIPE_PAYMENT&principal_id=eq.' + encodeURIComponent(user.id) + '&outcome->>order_id=eq.' + encodeURIComponent(cleanQuery(id)) + '&limit=1');
  return json(res, 200, { order_id: id, evidence: eventRows?.[0] || null });
}
async function profile(req, res, method) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  if (method === 'GET') {
    const rows = await db('GET', 'dreamledger_accounts', '?select=id,name,avatar,account_created_at&id=eq.' + encodeURIComponent(user.id) + '&limit=1');
    const account = rows?.[0] || null;
    if (account && typeof account.avatar === 'string') { try { account.avatar = JSON.parse(account.avatar); } catch {} }
    return json(res, 200, account);
  }
  const parsed = await body(req, 100000); const patch = {};
  if (parsed.value.display_name !== undefined) patch.name = String(parsed.value.display_name).trim().slice(0, 60) || 'Customer';
  if (parsed.value.avatar !== undefined) {
    if (!parsed.value.avatar || typeof parsed.value.avatar !== 'object' || Array.isArray(parsed.value.avatar)) return json(res, 422, { error: 'Invalid avatar selection' });
    patch.avatar = JSON.stringify(parsed.value.avatar);
  }
  if (!Object.keys(patch).length) return json(res, 400, { error: 'No profile changes supplied' });
  const rows = await db('PATCH', 'dreamledger_accounts', '?id=eq.' + encodeURIComponent(user.id), patch);
  const account = rows?.[0] || null;
  if (account && typeof account.avatar === 'string') { try { account.avatar = JSON.parse(account.avatar); } catch {} }
  return json(res, 200, account);
}
async function listAuctions(req, res) {
  const rows = await db('GET', 'dreamledger_auctions', '?select=*&order=ends_at.asc');
  return json(res, 200, { auctions: rows || [] });
}
async function auction(req, res, id) {
  const rows = await db('GET', 'dreamledger_auctions', '?select=*&id=eq.' + encodeURIComponent(cleanQuery(id)) + '&limit=1');
  if (!rows?.[0]) return json(res, 404, { error: 'Auction not found' });
  const bids = await db('GET', 'dreamledger_bids', '?select=bid_id,amount,status,agent_id,authority_id,created_at&auction_id=eq.' + encodeURIComponent(cleanQuery(id)) + '&order=created_at.desc&limit=50');
  return json(res, 200, { auction: rows[0], bids: bids || [] });
}
async function watch(req, res, id, remove) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  const auctionId = cleanQuery(id);
  if (remove) {
    await db('DELETE', 'dreamledger_watchlist', '?principal_id=eq.' + encodeURIComponent(user.id) + '&auction_id=eq.' + encodeURIComponent(auctionId), undefined, 'return=minimal');
    return json(res, 200, { ok: true, watched: false });
  }
  await db('POST', 'dreamledger_watchlist', '', { principal_id: user.id, auction_id: auctionId }, 'resolution=ignore-duplicates,return=minimal');
  return json(res, 200, { ok: true, watched: true });
}
async function createAuthority(req, res) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  const parsed = await body(req, 100000); const input = parsed.value;
  const authority = { authority_id: 'authz_' + crypto.randomBytes(12).toString('hex'), principal_id: user.id, agent_id: String(input.agent_id || '').trim(), max_bid: Number(input.max_bid), max_total_spend: Number(input.max_total_spend), allowed_auction_ids: Array.isArray(input.allowed_auction_ids) ? input.allowed_auction_ids.map(cleanQuery) : [], allowed_categories: Array.isArray(input.allowed_categories) ? input.allowed_categories.map(v => String(v).trim()).filter(Boolean) : [], expires_at: String(input.expires_at || ''), human_approval_required: input.human_approval_required !== false };
  if (!authority.agent_id || !Number.isFinite(authority.max_bid) || authority.max_bid < 0 || !Number.isFinite(authority.max_total_spend) || authority.max_total_spend < 0 || !authority.expires_at || new Date(authority.expires_at).getTime() <= Date.now()) return json(res, 422, { error: 'Invalid authority envelope' });
  const rows = await db('POST', 'dreamledger_authorities', '', authority);
  return json(res, 201, Array.isArray(rows) ? rows[0] : rows);
}
async function recordRejectedBid(user, auctionId, agentId, authorityId, amount, reason, authority) {
  const bidId = 'bid_' + crypto.randomBytes(12).toString('hex');
  if (auctionId) await db('POST', 'dreamledger_bids', '', { bid_id: bidId, auction_id: auctionId, principal_id: user.id, agent_id: agentId || null, authority_id: authorityId || null, amount: Number.isFinite(amount) ? amount : 0, status: 'rejected', rejection_reason: reason }, 'return=minimal').catch(() => {});
  await appendEvidence({ principalId: user.id, agentId: agentId || null, action: 'AGENT_BID', authority: authority || { authority_id: authorityId || null }, outcome: { allowed: false, reason, auction_id: auctionId, amount }, eventId: 'bid_reject_' + crypto.randomUUID() });
  return json;
}
async function agentBid(req, res) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  const parsed = await body(req, 100000); const input = parsed.value;
  const auctionId = cleanQuery(input.auction_id); const agentId = String(input.agent_id || '').trim(); const amount = Number(input.amount); const authorityId = cleanQuery(input.authority_id);
  const reject = async (reason, authority) => { const bidId = 'bid_' + crypto.randomBytes(12).toString('hex'); if (auctionId) await db('POST', 'dreamledger_bids', '', { bid_id: bidId, auction_id: auctionId, principal_id: user.id, agent_id: agentId || null, authority_id: authorityId || null, amount: Number.isFinite(amount) ? amount : 0, status: 'rejected', rejection_reason: reason }, 'return=minimal').catch(() => {}); await appendEvidence({ principalId: user.id, agentId: agentId || null, action: 'AGENT_BID', authority: authority || { authority_id: authorityId || null }, outcome: { allowed: false, reason, auction_id: auctionId, amount }, eventId: 'bid_reject_' + crypto.randomUUID() }); return json(res, 403, { allowed: false, reason }); };
  if (!agentId) return reject('MALFORMED_AGENT_IDENTITY');
  const aRows = await db('GET', 'dreamledger_authorities', '?select=*&authority_id=eq.' + encodeURIComponent(authorityId) + '&principal_id=eq.' + encodeURIComponent(user.id) + '&agent_id=eq.' + encodeURIComponent(agentId) + '&limit=1');
  const authority = aRows?.[0];
  if (!authority) return reject('AUTHORITY_NOT_FOUND');
  if (authority.revoked_at) return reject('AUTHORITY_REVOKED', authority);
  if (new Date(authority.expires_at).getTime() <= Date.now()) return reject('AUTHORITY_EXPIRED', authority);
  if (authority.human_approval_required) return reject('HUMAN_APPROVAL_REQUIRED', authority);
  if (!Number.isFinite(amount) || amount <= 0) return reject('INVALID_BID_AMOUNT', authority);
  if (amount > Number(authority.max_bid)) return reject('MAX_BID_EXCEEDED', authority);
  if (Array.isArray(authority.allowed_auction_ids) && authority.allowed_auction_ids.length && !authority.allowed_auction_ids.includes(auctionId)) return reject('AUCTION_NOT_AUTHORIZED', authority);
  const auctionRows = await db('GET', 'dreamledger_auctions', '?select=*&id=eq.' + encodeURIComponent(auctionId) + '&limit=1');
  const target = auctionRows?.[0];
  if (!target) return reject('AUCTION_NOT_FOUND', authority);
  if (target.status !== 'open') return reject('AUCTION_CLOSED', authority);
  if (new Date(target.ends_at).getTime() <= Date.now()) return reject('AUCTION_EXPIRED', authority);
  if (Array.isArray(authority.allowed_categories) && authority.allowed_categories.length && !authority.allowed_categories.includes(target.category)) return reject('CATEGORY_NOT_AUTHORIZED', authority);
  if (amount <= Number(target.current_bid)) return reject('BID_BELOW_CURRENT', authority);
  const spendRows = await db('GET', 'dreamledger_bids', '?select=amount&principal_id=eq.' + encodeURIComponent(user.id) + '&status=eq.accepted');
  const spend = (spendRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (spend + amount > Number(authority.max_total_spend)) return reject('MAX_TOTAL_SPEND_EXCEEDED', authority);
  const bidId = 'bid_' + crypto.randomBytes(12).toString('hex');
  const bidRows = await db('POST', 'dreamledger_bids', '', { bid_id: bidId, auction_id: auctionId, principal_id: user.id, agent_id: agentId, authority_id: authorityId, amount, status: 'accepted' });
  await db('PATCH', 'dreamledger_auctions', '?id=eq.' + encodeURIComponent(auctionId), { current_bid: amount });
  const evidence = await appendEvidence({ principalId: user.id, agentId, action: 'AGENT_BID', authority, outcome: { allowed: true, status: 'ACCEPTED', bid_id: bidId, auction_id: auctionId, amount }, eventId: 'bid_accept_' + bidId });
  return json(res, 201, { allowed: true, bid: bidRows?.[0] || null, evidence });
}
async function humanBid(req, res, auctionId) {
  const user = await principal(req); if (!user) return json(res, 401, { error: 'Authentication required' });
  const parsed = await body(req, 100000); const amount = Number(parsed.value.amount); const id = cleanQuery(auctionId);
  const rows = await db('GET', 'dreamledger_auctions', '?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1'); const target = rows?.[0];
  if (!target) return json(res, 404, { allowed: false, reason: 'AUCTION_NOT_FOUND' });
  const reject = async reason => { await appendEvidence({ principalId: user.id, action: 'HUMAN_BID', authority: { source: 'human_principal' }, outcome: { allowed: false, reason, auction_id: id, amount }, eventId: 'human_bid_reject_' + crypto.randomUUID() }); return json(res, 403, { allowed: false, reason }); };
  if (!Number.isFinite(amount) || amount <= 0) return reject('INVALID_BID_AMOUNT');
  if (target.status !== 'open') return reject('AUCTION_CLOSED');
  if (new Date(target.ends_at).getTime() <= Date.now()) return reject('AUCTION_EXPIRED');
  if (amount <= Number(target.current_bid)) return reject('BID_BELOW_CURRENT');
  const bidId = 'bid_' + crypto.randomBytes(12).toString('hex');
  const bidRows = await db('POST', 'dreamledger_bids', '', { bid_id: bidId, auction_id: id, principal_id: user.id, amount, status: 'accepted' });
  await db('PATCH', 'dreamledger_auctions', '?id=eq.' + encodeURIComponent(id), { current_bid: amount });
  const evidence = await appendEvidence({ principalId: user.id, action: 'HUMAN_BID', authority: { source: 'human_principal' }, outcome: { allowed: true, status: 'ACCEPTED', bid_id: bidId, auction_id: id, amount }, eventId: 'human_bid_accept_' + bidId });
  return json(res, 201, { allowed: true, bid: bidRows?.[0] || null, evidence });
}
async function handle(req, res, route) {
  if (route.startsWith('/api/auth/')) { const accountAuth = require('../compiled/website/lib/accountAuth'); return accountAuth.handle(req, res, route.replace('/api/auth/', '/api/account/')); }
  if (route === '/api/profile' && (req.method === 'GET' || req.method === 'PATCH')) return profile(req, res, req.method);
  if ((route === '/api/checkout' || route === '/api/offer-checkout/create') && req.method === 'POST') return createCheckout(req, res);
  if (route === '/api/webhooks/stripe' && req.method === 'POST') return stripeWebhook(req, res);
  if (route === '/api/orders' && req.method === 'GET') return getOrders(req, res);
  const orderMatch = route.match(/^\/api\/orders\/([^/]+)(\/proof)?$/); if (orderMatch && req.method === 'GET') return orderMatch[2] ? getOrderProof(req, res, orderMatch[1]) : getOrder(req, res, orderMatch[1]);
  if (route === '/api/auctions' && req.method === 'GET') return listAuctions(req, res);
  const auctionMatch = route.match(/^\/api\/auctions\/([^/]+)$/); if (auctionMatch && req.method === 'GET') return auction(req, res, auctionMatch[1]);
  const watchMatch = route.match(/^\/api\/auctions\/([^/]+)\/watch$/); if (watchMatch && (req.method === 'POST' || req.method === 'DELETE')) return watch(req, res, watchMatch[1], req.method === 'DELETE');
  const bidMatch = route.match(/^\/api\/auctions\/([^/]+)\/bids$/); if (bidMatch && req.method === 'POST') return humanBid(req, res, bidMatch[1]);
  if (route === '/api/authorities' && req.method === 'POST') return createAuthority(req, res);
  if (route === '/api/agent/bid' && req.method === 'POST') return agentBid(req, res);
  return false;
}
module.exports = { handle, appendEvidence };
