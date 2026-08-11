const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'compiled', 'website');
const CATALOG = path.join(__dirname, 'catalog', 'products');
const IP_CATALOG = path.join(__dirname, 'catalog', 'ip-capabilities.json');
const OFFER_CATALOG = path.join(__dirname, 'catalog', 'offers', 'offers.json');
const DATA = path.resolve(process.env.LEDGER_DATA_DIR || path.join(__dirname, 'data', 'transactions'));
const PROOFS = path.resolve(process.env.PROOF_DATA_DIR || path.join(__dirname, 'data', 'proofs'));
const FIRST_PAYMENT_PROOF = path.resolve(process.env.FIRST_PAYMENT_PROOF_PATH || path.join(PROOFS, 'FIRST_PAYMENT_PROOF.json'));
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const checkoutLocks = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(PROOFS, { recursive: true });

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (Buffer.isBuffer(body)) return res.end(body);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function productFiles() { if (!fs.existsSync(CATALOG)) return []; return fs.readdirSync(CATALOG).filter(x => x.endsWith('.json')).map(x => path.join(CATALOG, x)); }
function loadProducts() { return productFiles().map(readJson); }
function loadIpCatalog() { return readJson(IP_CATALOG); }
function loadOfferCatalog() { return readJson(OFFER_CATALOG); }
function paidTransactionExists(productId) {
  if (!fs.existsSync(DATA)) return false;
  return fs.readdirSync(DATA).some(file => {
    if (!file.endsWith('.json')) return false;
    try { return readJson(path.join(DATA, file)).product_id === productId && readJson(path.join(DATA, file)).payment_status === 'paid'; }
    catch { return false; }
  });
}
function publicProduct(p) {
  const sold = p.inventory < 1 || paidTransactionExists(p.id);
  const approvalRequired = Boolean(p.commercial_truth?.approval_required);
  return { id: p.id, silo: p.silo, name: p.name, description: p.description, price: p.price, currency: p.currency, inventory: sold ? 0 : p.inventory, condition: p.condition, status: sold ? 'sold' : p.status, approval_required: approvalRequired, checkout_available: !sold && p.status === 'published' && !approvalRequired };
}
function publicOffer(offer) {
  return {
    offer_id: offer.offer_id,
    capability_id: offer.capability_id,
    silo: offer.silo,
    name: offer.name,
    problem: offer.problem,
    input: offer.input,
    output: offer.output,
    target_buyer: offer.target_buyer,
    offer_type: offer.offer_type || offer.pricing_tier || offer.offer_id.split('-').slice(-1)[0].toLowerCase(),
    delivery_method: offer.delivery_mechanism,
    price: offer.price,
    currency: offer.currency,
    pricing_mode: offer.pricing_strategy || 'fixed',
    pricing_tier: offer.pricing_tier || null,
    eligibility: offer.eligibility,
    proof_of_delivery: offer.proof_of_delivery,
    refund_policy: offer.refund_rules,
    approval_required: offer.approval_required === true,
    checkout_available: offer.checkout_available === true,
    checkout_route: offer.checkout_route,
    status: offer.status,
    verification_rules: offer.verification_rules,
    source_capabilities: offer.provenance?.capability_ids || [],
    private_material_excluded: offer.provenance?.private_material === 'excluded'
  };
}
function getProduct(id) { return loadProducts().find(p => p.id === id); }
function getOffer(id) { return loadOfferCatalog().offers.find(o => o.offer_id === id); }
function safePath(urlPath) { const decoded = decodeURIComponent(urlPath); const candidate = path.normalize(path.join(ROOT, decoded)); if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) return null; return candidate; }
function serveFile(res, filePath) { fs.readFile(filePath, (err, data) => { if (err) return send(res, 404, 'Not Found', 'text/plain; charset=utf-8'); send(res, 200, data, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'); }); }
function readBody(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; if (data.length > 2_000_000) req.destroy(); }); req.on('end', () => resolve(data)); req.on('error', reject); }); }
function stripeForm(params) { const out = new URLSearchParams(); for (const [k, v] of Object.entries(params)) out.set(k, String(v)); return out; }
async function stripeRequest(endpoint, method, params, idempotencyKey) {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const headers = { Authorization: `Bearer ${STRIPE_SECRET_KEY}` };
  if (method !== 'GET') { headers['Content-Type'] = 'application/x-www-form-urlencoded'; if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey; }
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, { method, headers, body: method === 'GET' ? undefined : stripeForm(params) });
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(body?.error?.message || `Stripe API ${response.status}`); return body;
}
function verifyStripeSignature(raw, header) {
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const parts = Object.fromEntries(header.split(',').map(x => x.split('='))); const timestamp = parts.t; const signature = parts.v1;
  if (!timestamp || !signature) throw new Error('Invalid Stripe signature');
  const age = Math.abs(Date.now() / 1000 - Number(timestamp)); if (age > 300) throw new Error('Expired Stripe signature');
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${raw}`, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8'); const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid Stripe signature');
}
async function createCheckout(req, res) {
  let body; try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const product = getProduct(body.product_id);
  if (!product || product.status !== 'published') return send(res, 404, { error: 'Product not found' });
  if (body.silo !== product.silo) return send(res, 400, { error: 'Silo mismatch' });
  if (product.commercial_truth?.approval_required) return send(res, 403, { error: 'Human approval required' });
  if (product.inventory < 1 || paidTransactionExists(product.id)) return send(res, 409, { error: 'Sold out' });
  if (checkoutLocks.has(product.id)) return send(res, 409, { error: 'Checkout already being created' });
  checkoutLocks.set(product.id, true);
  try {
    const idempotencyKey = `dreamledger-product-${product.id}-${crypto.randomUUID()}`;
    const session = await stripeRequest('checkout/sessions', 'POST', {
      mode: product.checkout.mode,
      'line_items[0][price_data][currency]': product.currency,
      'line_items[0][price_data][unit_amount]': product.price,
      'line_items[0][price_data][product_data][name]': product.name,
      'line_items[0][price_data][product_data][description]': product.description,
      'line_items[0][quantity]': 1,
      'metadata[product_id]': product.id,
      'metadata[silo]': product.silo,
      'metadata[sku]': product.id,
      success_url: `${PUBLIC_BASE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE}/${product.silo}`
    }, idempotencyKey);
    return send(res, 200, { ok: true, session_id: session.id, checkout_url: session.url });
  } catch (err) { return send(res, 502, { error: err.message }); }
  finally { checkoutLocks.delete(product.id); }
}
async function createOfferCheckout(req, res) {
  let body; try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const offer = getOffer(body.offer_id);
  if (!offer) return send(res, 404, { error: 'Offer not found' });
  if (body.silo !== offer.silo) return send(res, 400, { error: 'Silo mismatch' });
  if (offer.approval_required !== false || offer.checkout_available !== true) return send(res, 403, { error: 'Offer is not approved for checkout' });
  if (typeof offer.price !== 'number' || offer.price <= 0 || offer.currency !== 'NZD') return send(res, 422, { error: 'Offer pricing is invalid' });
  if (checkoutLocks.has(offer.offer_id)) return send(res, 409, { error: 'Checkout already being created' });
  checkoutLocks.set(offer.offer_id, true);
  try {
    const idempotencyKey = `dreamledger-offer-${offer.offer_id}-${crypto.randomUUID()}`;
    const session = await stripeRequest('checkout/sessions', 'POST', {
      mode: 'payment',
      'line_items[0][price_data][currency]': 'nzd',
      'line_items[0][price_data][unit_amount]': Math.round(offer.price * 100),
      'line_items[0][price_data][product_data][name]': offer.name,
      'line_items[0][price_data][product_data][description]': offer.output,
      'line_items[0][quantity]': 1,
      'metadata[offer_id]': offer.offer_id,
      'metadata[capability_id]': offer.capability_id,
      'metadata[silo]': offer.silo,
      'metadata[pricing_tier]': offer.pricing_tier || offer.offer_type || '',
      success_url: `${PUBLIC_BASE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE}/`
    }, idempotencyKey);
    return send(res, 200, { ok: true, offer_id: offer.offer_id, session_id: session.id, checkout_url: session.url });
  } catch (err) { return send(res, 502, { error: err.message }); }
  finally { checkoutLocks.delete(offer.offer_id); }
}
async function webhook(req, res) {
  const raw = await readBody(req);
  try {
    verifyStripeSignature(raw, req.headers['stripe-signature'] || ''); const event = JSON.parse(raw);
    if (event.type !== 'checkout.session.completed') return send(res, 200, { received: true });
    const session = event.data.object; if (session.payment_status !== 'paid') return send(res, 200, { received: true, fulfilled: false });
    const productId = session.metadata?.product_id || null;
    const offerId = session.metadata?.offer_id || null;
    const product = productId ? getProduct(productId) : null;
    const offer = offerId ? getOffer(offerId) : null;
    if (!product && !offer) return send(res, 400, { error: 'Unknown product or offer' });
    const transactionId = session.id;
    const txFile = path.join(DATA, `${transactionId}.json`);
    if (fs.existsSync(txFile)) return send(res, 200, { received: true, idempotent: true });
    const silo = product?.silo || offer?.silo;
    const tx = {
      transaction_id: transactionId,
      product_id: product?.id || null,
      offer_id: offer?.offer_id || null,
      capability_id: offer?.capability_id || null,
      silo,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email || null,
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(txFile, JSON.stringify(tx, null, 2) + '\n', { flag: 'wx' });
    const proof = {
      type: 'dreamledger-transaction-proof',
      status: 'PASS',
      transaction_id: transactionId,
      product_id: product?.id || null,
      offer_id: offer?.offer_id || null,
      capability_id: offer?.capability_id || null,
      silo,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      payment_received: true,
      proof_source: 'stripe.checkout.session.completed.webhook',
      delivery_status: 'PENDING',
      recorded_at: tx.created_at
    };
    fs.writeFileSync(path.join(PROOFS, `${transactionId}.json`), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
    if (!fs.existsSync(FIRST_PAYMENT_PROOF)) fs.writeFileSync(FIRST_PAYMENT_PROOF, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
    return send(res, 200, { received: true, fulfilled: true, transaction_id: transactionId });
  } catch (err) { return send(res, 400, { error: err.message }); }
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'GET' && url === '/healthz') return send(res, 200, { status: 'ok', service: 'dreamledger', engine: 'commerce-v1', stripe_configured: Boolean(STRIPE_SECRET_KEY), webhook_configured: Boolean(STRIPE_WEBHOOK_SECRET), durable_ledger_configured: DATA.startsWith('/var/data') || PROOFS.startsWith('/var/data'), first_payment_proof_path: FIRST_PAYMENT_PROOF, ip_catalog_configured: fs.existsSync(IP_CATALOG), offer_catalog_configured: fs.existsSync(OFFER_CATALOG) });
  if (req.method === 'GET' && url === '/api/products') return send(res, 200, { products: loadProducts().filter(p => p.status === 'published').map(publicProduct) });
  if (req.method === 'GET' && url.startsWith('/api/products/')) { const product = getProduct(url.slice('/api/products/'.length)); return product ? send(res, 200, publicProduct(product)) : send(res, 404, { error: 'Product not found' }); }
  if (req.method === 'GET' && url === '/api/ip') { try { return send(res, 200, loadIpCatalog()); } catch (err) { return send(res, 500, { error: err.message }); } }
  if (req.method === 'GET' && url === '/api/offers') { try { return send(res, 200, { offers: loadOfferCatalog().offers.map(publicOffer) }); } catch (err) { return send(res, 500, { error: err.message }); } }
  if (req.method === 'GET' && url.startsWith('/api/offers/')) { try { const offer = getOffer(url.slice('/api/offers/'.length)); return offer ? send(res, 200, publicOffer(offer)) : send(res, 404, { error: 'Offer not found' }); } catch (err) { return send(res, 500, { error: err.message }); } }
  if (req.method === 'POST' && url === '/api/checkout/create') return createCheckout(req, res);
  if (req.method === 'POST' && url === '/api/offer-checkout/create') return createOfferCheckout(req, res);
  if (req.method === 'POST' && url === '/webhook') return webhook(req, res);
  if (req.method === 'GET' && url === '/checkout/success') return send(res, 200, '<!doctype html><html><head><meta charset="utf-8"><title>DreamLedger | Payment received</title></head><body style="font-family:system-ui;max-width:720px;margin:80px auto;padding:24px"><h1>Payment received</h1><p>Your Stripe checkout completed. Transaction evidence is generated after webhook confirmation.</p><p><a href="/">Return to DreamLedger</a></p></body></html>', 'text/html; charset=utf-8');
  if (req.method === 'GET' && url === '/checkout/cancel') return res.writeHead(302, { Location: '/mtg' }).end();
  let requestPath = url; if (requestPath === '/') requestPath = '/index.html'; let filePath = safePath(requestPath); if (!filePath) return send(res, 400, 'Bad Request', 'text/plain; charset=utf-8');
  try { if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html'); } catch {}
  return serveFile(res, filePath);
});
server.listen(PORT, '0.0.0.0', () => console.log(`DreamLedger commerce engine running on port ${PORT}`));
