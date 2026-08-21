'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const billboard = require('./billboard');
const stripeWebhookProof = require('../lib/stripeWebhookProof');

const ROOT = path.join(__dirname, '..');
const CART_DIR = path.join(ROOT, 'data', 'marketplace', 'carts');
const SELLERS = path.join(ROOT, 'data', 'marketplace', 'sellers.json');
const CATALOG = path.join(ROOT, 'catalog', 'products');
const PROOFS = path.resolve(process.env.PROOF_DATA_DIR || path.join(ROOT, 'data', 'proofs'));
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function form(params) { const out = new URLSearchParams(); for (const [k,v] of Object.entries(params)) out.set(k, String(v)); return out; }
async function stripe(endpoint, params, key) {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const response = await fetch('https://api.stripe.com/v1/' + endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': key }, body: form(params) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe API ' + response.status);
  return data;
}
function platformSellerIds() { if (!fs.existsSync(SELLERS)) return []; return read(SELLERS).filter(s => s.status === 'active' && s.platform === true).map(s => s.id); }
function verify(raw, header) {
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const parts = String(header || '').split(',');
  const timestamp = (parts.find(x => x.startsWith('t=')) || '').slice(2);
  const signatures = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || !signatures.length) throw new Error('Invalid Stripe signature');
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error('Expired Stripe signature');
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(timestamp + '.' + raw, 'utf8').digest('hex');
  if (!signatures.some(sig => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))) throw new Error('Invalid Stripe signature');
}
function product(productId) {
  const file = path.join(CATALOG, String(productId) + '.json');
  if (!fs.existsSync(file)) return null;
  return read(file);
}
function productIdByPaymentLink(paymentLinkId) {
  if (!paymentLinkId || !fs.existsSync(CATALOG)) return null;
  const files = fs.readdirSync(CATALOG).filter(name => name.endsWith('.json'));
  for (const file of files) {
    const p = read(path.join(CATALOG, file));
    if (p?.commercial_truth?.payment_link_id === paymentLinkId) return p.id;
  }
  return null;
}
async function createProductCheckout(productId, silo) {
  const p = product(productId);
  if (!p || p.status !== 'published' || Number(p.inventory || 0) < 1 || p.commercial_truth?.approval_required !== false) throw new Error('Product is not checkoutable');
  const cartId = 'direct_' + crypto.randomUUID();
  const params = { mode: 'payment', 'integration_identifier': 'dreamledger-mtg-checkout-' + crypto.randomBytes(4).toString('hex'), 'success_url': PUBLIC_BASE + '/checkout/success?product_id=' + encodeURIComponent(p.id), 'cancel_url': PUBLIC_BASE + '/revenue.html?checkout_cancelled=1', 'metadata[product_id]': p.id, 'metadata[silo]': silo || p.silo || 'dreamledger', 'metadata[commerce_version]': 'bec-direct-product-v1', 'line_items[0][price_data][currency]': String(p.currency || 'nzd').toLowerCase(), 'line_items[0][price_data][unit_amount]': Number(p.price), 'line_items[0][price_data][product_data][name]': p.name, 'line_items[0][price_data][product_data][metadata][product_id]': p.id, 'line_items[0][quantity]': 1 };
  const session = await stripe('checkout/sessions', params, 'dreamledger-direct-' + p.id + '-' + cartId);
  return { ok: true, offer_id: p.id, session_id: session.id, checkout_url: session.url, url: session.url, amount_minor: Number(p.price), currency: String(p.currency || 'nzd').toLowerCase() };
}
async function handle(req, res, url) {
  if (req.method === 'POST' && url === '/api/cart/checkout') {
    let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 200000) throw new Error('Request too large'); }
    let input; try { input = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
    if (!input.cart_id) return send(res, 400, { error: 'cart_id is required' });
    const file = path.join(CART_DIR, String(input.cart_id) + '.json');
    if (!fs.existsSync(file)) return send(res, 404, { error: 'Cart not found' });
    const cart = read(file); if (cart.status !== 'open') return send(res, 409, { error: 'Cart is not open' });
    const allowed = new Set(platformSellerIds()); if (!cart.items.every(item => allowed.has(item.seller_id))) return false;
    const params = { mode: 'payment', 'integration_identifier': 'dreamledger-platform-cart-' + crypto.randomBytes(4).toString('hex'), 'success_url': PUBLIC_BASE + '/checkout/success?cart_id=' + encodeURIComponent(cart.id), 'cancel_url': PUBLIC_BASE + '/?cart_cancelled=1', 'metadata[cart_id]': cart.id, 'metadata[commerce_version]': 'omni-v1-platform', 'metadata[platform_fee_bps]': '0' };
    cart.items.forEach((item, i) => { params['line_items[' + i + '][price_data][currency]'] = String(item.currency).toLowerCase(); params['line_items[' + i + '][price_data][unit_amount]'] = item.unit_amount; params['line_items[' + i + '][price_data][product_data][name]'] = item.name; params['line_items[' + i + '][quantity]'] = item.quantity; });
    try { const session = await stripe('checkout/sessions', params, 'dreamledger-platform-cart-' + cart.id + '-' + crypto.randomUUID()); cart.status = 'checkout_created'; cart.session_id = session.id; cart.checkout_created_at = new Date().toISOString(); write(file, cart); return send(res, 200, { ok: true, cart_id: cart.id, session_id: session.id, checkout_url: session.url, commission_bps: 0 }); } catch (err) { return send(res, 502, { error: err.message }); }
  }
  return false;
}
async function handleWebhook(req, res) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 5000000) throw new Error('Request too large'); }
  const event = JSON.parse(raw || '{}'); const session = event?.data?.object; const cartId = session?.metadata?.cart_id;
  verify(raw, req.headers['stripe-signature']);
  if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
    if (billboard.handlePaidSession(session)) return { handled: true };
    const productId = session?.metadata?.product_id;
    if (productId) {
      const timestamp = new Date().toISOString();
      const proof = { schema_version: 'BEC-FOSSIL-1.0', event: event.type, status: 'PASS', evidence_level: 1, asset_id: productId, transaction_id: session.id, amount: session.amount_total, currency: session.currency || 'nzd', timestamp_utc: timestamp };
      write(path.join(PROOFS, 'FIRST_PAYMENT_PROOF.json'), proof);
      write(path.join(PROOFS, 'FIRST_PAYMENT_PROOF-' + session.id + '.json'), proof);
      return { handled: true };
    }
    if (session?.payment_link) {
      const paymentProof = stripeWebhookProof.handleStripeWebhook(raw, req.headers['stripe-signature'], {
        webhookSecret: STRIPE_WEBHOOK_SECRET,
        getProduct: product,
        getProductByPaymentLink: productIdByPaymentLink,
        dirs: stripeWebhookProof.resolveDirs(process.env),
      });
      if (paymentProof.handled) return { handled: true };
    }
  }
  if (!cartId) return { handled: false, raw };
  const file = path.join(CART_DIR, String(cartId) + '.json'); if (!fs.existsSync(file)) return { handled: false, raw };
  const cart = read(file); const allowed = new Set(platformSellerIds());
  if (!cart.items.every(item => allowed.has(item.seller_id))) return { handled: false, raw };
  if (event.type === 'checkout.session.completed' && session.payment_status === 'paid' && cart.status !== 'settled') {
    const timestamp = new Date().toISOString();
    const proof = { schema_version: 'BEC-OMNI-FOSSIL-1.0', event: event.type, status: 'PASS', evidence_level: 1, transaction_id: session.id, cart_id: cart.id, amount_minor: session.amount_total, currency: session.currency || 'nzd', platform_commission_bps: 0, stripe_processing_fees_excluded: true, transfers: [], idempotency_key: 'dreamledger-platform-cart-' + cart.id, timestamp_utc: timestamp };
    cart.status = 'settled'; cart.settled_at = timestamp; cart.fossil = proof; write(file, cart); write(path.join(PROOFS, 'OMNI-' + cart.id + '.json'), proof);
  }
  return { handled: true };
}
module.exports = { handle, handleWebhook, createProductCheckout };
