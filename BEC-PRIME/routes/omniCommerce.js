'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'catalog', 'products');
const DATA = path.resolve(process.env.LEDGER_DATA_DIR || path.join(ROOT, 'data', 'transactions'));
const MARKET_DATA = path.join(ROOT, 'data', 'marketplace');
const SELLERS_FILE = path.join(MARKET_DATA, 'sellers.json');
const CART_DIR = path.join(MARKET_DATA, 'carts');
const PROOFS = path.resolve(process.env.PROOF_DATA_DIR || path.join(ROOT, 'data', 'proofs'));
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.MARKETPLACE_ADMIN_TOKEN || '';
const PLATFORM_FEE_BPS = 500;
const FORBIDDEN = ['amplissa', 'bbw', 'big beautiful women', 'adult-only', 'adult only', 'adult_silo'];

fs.mkdirSync(MARKET_DATA, { recursive: true });
fs.mkdirSync(CART_DIR, { recursive: true });
fs.mkdirSync(PROOFS, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function cleanPublic(value) {
  const text = JSON.stringify(value).toLowerCase();
  const hit = FORBIDDEN.find(token => text.includes(token));
  if (hit) throw new Error('PUBLIC_SILO_GATE_FAILED:' + hit);
  return value;
}
function body(req, limit = 2000000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > limit) req.destroy(new Error('Request too large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}
function rawBody(req, limit = 5000000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > limit) req.destroy(new Error('Request too large')); });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}
function auth(req) { return Boolean(ADMIN_TOKEN) && String(req.headers.authorization || '') === 'Bearer ' + ADMIN_TOKEN; }
function sellers() { const x = readJson(SELLERS_FILE, []); return Array.isArray(x) ? x : []; }
function saveSellers(value) { writeJson(SELLERS_FILE, value); }
function products() {
  if (!fs.existsSync(CATALOG)) return [];
  return fs.readdirSync(CATALOG).filter(x => x.endsWith('.json')).map(x => readJson(path.join(CATALOG, x), null)).filter(Boolean);
}
function product(id) { return products().find(p => p.id === id); }
function approvedProduct(p) {
  return Boolean(p && p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0);
}
function seller(id) { return sellers().find(s => s.id === id && s.status !== 'suspended'); }
function publicSeller(s) { return cleanPublic({ id: s.id, slug: s.slug, name: s.name, status: s.status, plan: s.plan }); }
function publicProduct(p) {
  const s = seller(p.seller || '');
  return cleanPublic({ id: p.id, seller_id: p.seller || null, seller: s ? publicSeller(s) : null, silo: p.silo, name: p.name, description: p.description, price: Number(p.price), currency: p.currency || 'NZD', inventory: Number(p.inventory || 0), condition: p.condition || null, status: 'published', checkout_available: approvedProduct(p) });
}
function makeCart(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new Error('items must contain 1-50 entries');
  const normalized = items.map(item => {
    const p = product(String(item.product_id || ''));
    const quantity = Number(item.quantity || 1);
    if (!approvedProduct(p)) throw new Error('Product is not checkoutable: ' + String(item.product_id));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Invalid quantity for ' + p.id);
    if (quantity > Number(p.inventory)) throw new Error('Insufficient inventory for ' + p.id);
    const s = seller(p.seller || 'HappyHomarid');
    if (!s || s.status !== 'active') throw new Error('Seller is not active for ' + p.id);
    return { product_id: p.id, seller_id: s.id, quantity, unit_amount: Number(p.price), currency: p.currency || 'NZD', name: p.name, silo: p.silo };
  });
  const total = normalized.reduce((n, x) => n + x.unit_amount * x.quantity, 0);
  const cart = { id: 'cart_' + crypto.randomUUID(), status: 'open', items: normalized, total_amount: total, currency: 'NZD', created_at: new Date().toISOString() };
  writeJson(path.join(CART_DIR, cart.id + '.json'), cart);
  return cart;
}
function getCart(id) { return readJson(path.join(CART_DIR, String(id) + '.json'), null); }
function stripeForm(params) { const out = new URLSearchParams(); for (const [k, v] of Object.entries(params)) out.set(k, String(v)); return out; }
async function stripeRequest(endpoint, params, idempotencyKey) {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const headers = { Authorization: 'Bearer ' + STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch('https://api.stripe.com/v1/' + endpoint, { method: 'POST', headers, body: stripeForm(params) });
  const text = await response.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  if (!response.ok) throw new Error(parsed?.error?.message || 'Stripe API ' + response.status);
  return parsed;
}
function verifyStripe(raw, header) {
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const parts = String(header || '').split(',');
  const timestamp = (parts.find(x => x.startsWith('t=')) || '').slice(2);
  const signatures = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || !signatures.length) throw new Error('Invalid Stripe signature');
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error('Expired Stripe signature');
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(timestamp + '.' + raw, 'utf8').digest('hex');
  if (!signatures.some(sig => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))) throw new Error('Invalid Stripe signature');
}
function allocations(cart) {
  const grouped = new Map();
  for (const item of cart.items) grouped.set(item.seller_id, (grouped.get(item.seller_id) || 0) + item.unit_amount * item.quantity);
  return [...grouped.entries()].map(([seller_id, amount]) => ({ seller_id, amount }));
}
function commission(amount) { return Math.floor(Number(amount) * PLATFORM_FEE_BPS / 10000); }
async function createCartCheckout(cart) {
  const alloc = allocations(cart);
  for (const a of alloc) {
    const s = seller(a.seller_id);
    if (!s || !s.stripe_connect_account_id) throw new Error('Seller is not payment-ready: ' + a.seller_id);
  }
  const gross = alloc.reduce((n, a) => n + a.amount, 0);
  const platformFee = commission(gross);
  const sellerNet = alloc.map(a => ({ ...a, platform_fee: commission(a.amount), seller_net: a.amount - commission(a.amount) }));
  const params = {
    mode: 'payment',
    'success_url': PUBLIC_BASE + '/checkout/success?cart_id=' + encodeURIComponent(cart.id),
    'cancel_url': PUBLIC_BASE + '/?cart_cancelled=1',
    'metadata[cart_id]': cart.id,
    'metadata[commerce_version]': 'omni-v1', 'metadata[product_id]': cart.items.length === 1 ? cart.items[0].product_id : cart.id, 'metadata[product_sku]': cart.items.length === 1 ? cart.items[0].product_id : cart.id, 'metadata[offer_id]': cart.items.length === 1 ? cart.items[0].product_id : cart.id, 'metadata[silo]': cart.items.length === 1 ? cart.items[0].silo : 'omni', 'metadata[source]': 'omni_cart', 'payment_intent_data[metadata][product_id]': cart.items.length === 1 ? cart.items[0].product_id : cart.id, 'payment_intent_data[metadata][product_sku]': cart.items.length === 1 ? cart.items[0].product_id : cart.id, 'payment_intent_data[metadata][offer_id]': cart.items.length === 1 ? cart.items[0].product_id : cart.id, 'payment_intent_data[metadata][silo]': cart.items.length === 1 ? cart.items[0].silo : 'omni', 'payment_intent_data[metadata][source]': 'omni_cart',
    'metadata[platform_fee_bps]': String(PLATFORM_FEE_BPS),
    'metadata[platform_fee_amount]': String(platformFee),
    'metadata[gross_amount]': String(gross)
  };
  cart.items.forEach((item, i) => {
    params['line_items[' + i + '][price_data][currency]'] = String(item.currency).toLowerCase();
    params['line_items[' + i + '][price_data][unit_amount]'] = item.unit_amount;
    params['line_items[' + i + '][price_data][product_data][name]'] = item.name;
    params['line_items[' + i + '][price_data][product_data][metadata][product_id]'] = item.product_id;
    params['line_items[' + i + '][price_data][product_data][metadata][seller_id]'] = item.seller_id;
    params['line_items[' + i + '][quantity]'] = item.quantity;
  });
  const session = await stripeRequest('checkout/sessions', params, 'dreamledger-cart-' + cart.id);
  cart.status = 'checkout_created';
  cart.session_id = session.id;
  cart.allocations = sellerNet;
  cart.gross_amount = gross;
  cart.platform_fee_bps = PLATFORM_FEE_BPS;
  cart.platform_fee_amount = platformFee;
  cart.checkout_created_at = new Date().toISOString();
  writeJson(path.join(CART_DIR, cart.id + '.json'), cart);
  return session;
}
async function connectOnboarding(sellerId) {
  const list = sellers();
  const idx = list.findIndex(s => s.id === sellerId);
  if (idx < 0) throw new Error('Seller not found');
  const s = list[idx];
  let accountId = s.stripe_connect_account_id;
  if (!accountId) {
    const account = await stripeRequest('accounts', {
      type: 'express',
      'business_profile[name]': s.name,
      'metadata[seller_id]': s.id,
      'capabilities[card_payments][requested]': 'true',
      'capabilities[transfers][requested]': 'true'
    }, 'dreamledger-connect-account-' + s.id);
    accountId = account.id;
    s.stripe_connect_account_id = accountId;
    list[idx] = s;
    saveSellers(list);
  }
  const link = await stripeRequest('account_links', {
    account: accountId,
    refresh_url: PUBLIC_BASE + '/seller/onboarding?refresh=1',
    return_url: PUBLIC_BASE + '/seller/onboarding?complete=1',
    type: 'account_onboarding'
  }, 'dreamledger-connect-link-' + s.id + '-' + Date.now());
  return { seller_id: s.id, account_id: accountId, onboarding_url: link.url };
}
async function settleCart(event) {
  const session = event.data.object;
  const cartId = session.metadata?.cart_id;
  if (!cartId) return false;
  const cart = getCart(cartId);
  if (!cart) throw new Error('Cart not found: ' + cartId);
  if (cart.status === 'settled') return true;
  if (session.payment_status !== 'paid') return true;
  const transferGroup = 'dreamledger-' + cart.id;
  const transfers = [];
  for (const allocation of cart.allocations || allocations(cart)) {
    const s = seller(allocation.seller_id);
    if (!s || !s.stripe_connect_account_id) throw new Error('Seller payment account missing: ' + allocation.seller_id);
    const sellerNet = Number(allocation.seller_net ?? (allocation.amount - commission(allocation.amount)));
    const transfer = await stripeRequest('transfers', {
      amount: sellerNet,
      currency: 'nzd',
      destination: s.stripe_connect_account_id,
      'transfer_group': transferGroup,
      'metadata[cart_id]': cart.id,
      'metadata[seller_id]': s.id,
      'metadata[platform_fee_bps]': String(PLATFORM_FEE_BPS),
      'metadata[gross_allocation]': String(allocation.amount),
      'metadata[platform_fee_amount]': String(allocation.platform_fee ?? commission(allocation.amount))
    }, 'dreamledger-transfer-' + cart.id + '-' + s.id);
    transfers.push({ seller_id: s.id, gross_amount: allocation.amount, platform_fee_bps: PLATFORM_FEE_BPS, platform_fee_amount: Number(allocation.platform_fee ?? commission(allocation.amount)), seller_net: sellerNet, transfer_id: transfer.id });
  }
  const grossAmount = Number(session.amount_total || cart.gross_amount || 0);
  const platformFee = Number(cart.platform_fee_amount ?? commission(grossAmount));
  const sellerNetTotal = transfers.reduce((n, t) => n + t.seller_net, 0);
  const proof = {
    schema_version: 'BEC-OMNI-FOSSIL-1.0', event: event.type, status: 'PASS', evidence_level: 1,
    transaction_id: session.id, cart_id: cart.id, amount_minor: grossAmount, currency: 'nzd',
    platform_commission_bps: PLATFORM_FEE_BPS, platform_commission_amount: platformFee,
    seller_net_amount: sellerNetTotal, stripe_processing_fees_excluded: true, transfers,
    idempotency_key: 'dreamledger-cart-' + cart.id, timestamp_utc: new Date().toISOString()
  };
  cart.status = 'settled';
  cart.settled_at = proof.timestamp_utc;
  cart.transfers = transfers;
  cart.fossil = proof;
  writeJson(path.join(CART_DIR, cart.id + '.json'), cart);
  writeJson(path.join(PROOFS, 'OMNI-' + cart.id + '.json'), proof);
  return true;
}
async function handleWebhook(req, res) {
  const raw = await rawBody(req);
  const event = JSON.parse(raw || '{}');
  if (!event?.data?.object?.metadata?.cart_id) return { handled: false, raw };
  verifyStripe(raw, req.headers['stripe-signature']);
  if (event.type === 'checkout.session.completed') {
    await settleCart(event);
    return { handled: true };
  }
  return { handled: true };
}

async function handle(req, res, url) {
  if (url === '/api/marketplace' && req.method === 'GET') {
    const parsed = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const q = parsed.searchParams.get('q')?.trim().toLowerCase() || '';
    const silo = parsed.searchParams.get('silo') || '';
    const sellerId = parsed.searchParams.get('seller_id') || '';
    const items = products().filter(approvedProduct).filter(p => !silo || p.silo === silo).filter(p => !sellerId || p.seller === sellerId).filter(p => !q || (String(p.name) + ' ' + String(p.description)).toLowerCase().includes(q)).map(publicProduct);
    return json(res, 200, cleanPublic({ products: items, count: items.length, commission_bps: PLATFORM_FEE_BPS, search: q || null }));
  }
  if (url === '/api/marketplace/categories' && req.method === 'GET') {
    const counts = {};
    products().filter(approvedProduct).forEach(p => { const c = p.category || p.silo || 'general'; counts[c] = (counts[c] || 0) + 1; });
    return json(res, 200, { categories: Object.entries(counts).map(([id, count]) => ({ id, count })) });
  }
  if (url === '/api/sellers' && req.method === 'GET') return json(res, 200, cleanPublic({ sellers: sellers().filter(s => s.status === 'active').map(publicSeller) }));
  const sellerMatch = url.match(/^\/api\/sellers\/([^/]+)$/);
  if (sellerMatch && req.method === 'GET') { const s = seller(decodeURIComponent(sellerMatch[1])); return s ? json(res, 200, publicSeller(s)) : json(res, 404, { error: 'Seller not found' }); }
  if (url === '/api/sellers' && req.method === 'POST') {
    if (!auth(req)) return json(res, 401, { error: 'Unauthorized' });
    const b = await body(req); if (!b.id || !b.name || !b.slug) return json(res, 400, { error: 'id, name and slug are required' });
    if (FORBIDDEN.some(x => String(b.id + ' ' + b.name + ' ' + b.slug).toLowerCase().includes(x))) return json(res, 400, { error: 'Silo is not permitted on this platform' });
    const list = sellers(); if (list.some(s => s.id === String(b.id) || s.slug === String(b.slug))) return json(res, 409, { error: 'Seller already exists' });
    list.push({ id: String(b.id), slug: String(b.slug), name: String(b.name), plan: b.plan || 'starter', status: 'pending_payment_setup', stripe_connect_account_id: null, created_at: new Date().toISOString() }); saveSellers(list);
    return json(res, 201, { success: true, seller: publicSeller(list[list.length - 1]) });
  }
  const onboardingMatch = url.match(/^\/api\/sellers\/([^/]+)\/connect\/onboarding$/);
  if (onboardingMatch && req.method === 'POST') { if (!auth(req)) return json(res, 401, { error: 'Unauthorized' }); try { return json(res, 200, await connectOnboarding(decodeURIComponent(onboardingMatch[1]))); } catch (err) { return json(res, 502, { error: err.message }); } }
  if (url === '/api/cart' && req.method === 'POST') { try { const cart = makeCart((await body(req)).items); return json(res, 201, cleanPublic({ cart_id: cart.id, items: cart.items, total_amount: cart.total_amount, currency: cart.currency, status: cart.status })); } catch (err) { return json(res, 422, { error: err.message }); } }
  const cartMatch = url.match(/^\/api\/cart\/([^/]+)$/);
  if (cartMatch && req.method === 'GET') { const cart = getCart(decodeURIComponent(cartMatch[1])); return cart ? json(res, 200, cleanPublic(cart)) : json(res, 404, { error: 'Cart not found' }); }
  if (url === '/api/cart/checkout' && req.method === 'POST') { try { const cart = getCart((await body(req)).cart_id); if (!cart) return json(res, 404, { error: 'Cart not found' }); if (cart.status !== 'open') return json(res, 409, { error: 'Cart is not open' }); const session = await createCartCheckout(cart); return json(res, 200, { ok: true, cart_id: cart.id, session_id: session.id, checkout_url: session.url, commission_bps: PLATFORM_FEE_BPS }); } catch (err) { return json(res, 502, { error: err.message }); } }
  if (url === '/api/omni/healthz' && req.method === 'GET') {
    const list = sellers(); const ready = list.filter(s => s.status === 'active' && s.stripe_connect_account_id).length;
    return json(res, 200, { status: 'ok', engine: 'omni-commerce-v1', sellers: list.length, payment_ready_sellers: ready, commission_bps: PLATFORM_FEE_BPS, stripe_configured: Boolean(STRIPE_SECRET_KEY), webhook_configured: Boolean(STRIPE_WEBHOOK_SECRET), silo_firewall: 'PASS' });
  }
  return false;
}

module.exports = { handle, handleWebhook };