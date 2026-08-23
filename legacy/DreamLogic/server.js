const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const QRCode = require('qrcode');
const app = express();
const PORT = Number(process.env.PORT || 10000), ROOT = __dirname;
const PROOF_ROOT = process.env.PROOF_ROOT || path.join(ROOT, 'Proof', 'Fossils');
const LOG_ROOT = process.env.LOG_ROOT || path.join(ROOT, 'Proof', 'Scans');
const DATA_ROOT = process.env.DATA_ROOT || '/var/data';
const FALLBACK_DATA_ROOT = path.join(ROOT, 'data');
const BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const QR_BASE_DOMAIN = (process.env.QR_BASE_DOMAIN || 'https://qr.dreamledger.org').replace(/\/$/, '');
const QR_CODE = process.env.QR_CODE || 'DL1';
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || 'en';
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || 'NZ';
const GEO_COUNTRY_HEADER = (process.env.GEO_COUNTRY_HEADER || 'cf-ipcountry').toLowerCase();

const offers = {
  'COMMANDER-DECK-DIAGNOSTIC-001': {
    id: 'COMMANDER-DECK-DIAGNOSTIC-001', name: 'Commander Deck Diagnostic',
    prices: { NZ: { currency: 'nzd', amount: 25 }, US: { currency: 'usd', amount: 15 }, EU: { currency: 'eur', amount: 14 }, INTL: { currency: 'usd', amount: 15 } },
    status: 'published', checkout_available: true, approval_required: false, silo: 'MTG', gauntlet_status: 'PASS', stripe_price_env: { NZ: 'STRIPE_PRICE_NZ', US: 'STRIPE_PRICE_US', EU: 'STRIPE_PRICE_EU', INTL: 'STRIPE_PRICE_INTL' }
  }
};
const languageMap = {
  en: { hero: 'A verified commerce doorway, not a generic storefront', sub: 'Discover isolated worlds. Enter a silo. Trust the evidence.', cta: 'Enter the catalogue', proof: 'Evidence first. Claims second.' },
  es: { hero: 'Una puerta comercial verificable, no una tienda generica', sub: 'Descubre mundos aislados. Entra en un silo. Confia en la evidencia.', cta: 'Entrar al catalogo', proof: 'Primero evidencia. Despues afirmaciones.' },
  fr: { hero: 'Une porte commerciale verifiable, pas une vitrine generique', sub: 'Decouvrez des mondes isoles. Entrez dans un silo. Faites confiance aux preuves.', cta: 'Entrer dans le catalogue', proof: 'Les preuves avant les affirmations.' },
  de: { hero: 'Ein verifizierter Commerce-Eingang, kein generischer Shop', sub: 'Isolierte Welten entdecken. Ein Silo betreten. Beweisen vertrauen.', cta: 'Katalog betreten', proof: 'Erst Beweise. Dann Behauptungen.' },
  ja: { hero: '一般的な店舗ではなく、検証可能なコマース入口', sub: '独立した世界を発見し、サイロに入り、証拠を確認します。', cta: 'カタログへ', proof: '証拠を先に。主張は後に。' },
  'zh-CN': { hero: '可验证的商业入口，而不是普通商店', sub: '发现隔离世界，进入独立领域，以证据为准。', cta: '进入目录', proof: '证据优先，主张随后。' },
  'zh-TW': { hero: '可驗證的商業入口，而不是普通商店', sub: '探索隔離世界，進入獨立領域，以證據為準。', cta: '進入目錄', proof: '證據優先，主張隨後。' }
};

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function ensureDirs() { ensureDir(PROOF_ROOT); ensureDir(LOG_ROOT); }
function dataRoot() {
  try { ensureDir(DATA_ROOT); fs.accessSync(DATA_ROOT, fs.constants.W_OK); return DATA_ROOT; }
  catch (_) { ensureDir(FALLBACK_DATA_ROOT); return FALLBACK_DATA_ROOT; }
}
function dataFile(name) { return path.join(dataRoot(), name); }
function readJson(name, fallback) {
  const f = dataFile(name);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return fallback; }
}
function writeJson(name, value) {
  const f = dataFile(name), tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, f);
}
function cleanLang(v) { v = String(v || '').trim(); if (languageMap[v]) return v; const b = v.toLowerCase().split('-')[0]; return Object.keys(languageMap).find(k => k.toLowerCase() === b) || DEFAULT_LANGUAGE; }
function detectCountry(req) { const d = String(req.headers[GEO_COUNTRY_HEADER] || '').toUpperCase(); if (/^[A-Z]{2}$/.test(d)) return d; const a = String(req.headers['accept-language'] || '').toLowerCase(); if (a.includes('en-nz')) return 'NZ'; if (a.includes('en-us')) return 'US'; if (a.includes('fr-') || a.includes('de-')) return 'EU'; return DEFAULT_COUNTRY; }
function detectLanguage(req) { return cleanLang(req.query.lang || String(req.headers['accept-language'] || '').split(',')[0]); }
function regionFor(c) { if (c === 'NZ') return 'NZ'; if (c === 'US') return 'US'; if (['AT','BE','CY','DE','DK','ES','FI','FR','GR','IE','IT','LU','MT','NL','PT','SI','SK'].includes(c)) return 'EU'; return 'INTL'; }
function money(r) { return offers['COMMANDER-DECK-DIAGNOSTIC-001'].prices[r]; }
function logScan(row) { ensureDirs(); fs.appendFileSync(path.join(LOG_ROOT, `${new Date().toISOString().slice(0, 10)}.jsonl`), JSON.stringify(row) + '\n', 'utf8'); }

function readCatalogProducts() {
  const dir = path.join(ROOT, 'catalog', 'products');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { return null; }
  }).filter(Boolean);
}
function catalogMtgOffers() {
  return readCatalogProducts()
    .filter(x => String(x.silo || '').toUpperCase() === 'MTG')
    .filter(x => String(x.status || '').toLowerCase() === 'published')
    .map(x => ({
      ...x,
      prices: x.prices || (Number.isFinite(Number(x.price_nzd ?? x.price)) ? { NZ: { currency: 'nzd', amount: Number(x.price_nzd ?? x.price) } } : undefined),
      checkout_available: x.checkout_available === true && x.approval_required !== true,
      approval_required: x.approval_required === true,
      stripe_price_env: x.stripe_price_env || null
    }));
}
function publicOffers() {
  const merged = new Map(Object.entries(offers));
  for (const product of catalogMtgOffers()) {
    if (product.id && !merged.has(product.id)) merged.set(product.id, product);
  }
  return [...merged.values()];
}
function findOffer(id) { return publicOffers().find(x => String(x.id) === String(id)); }
function stripePriceEnvFor(offer, region) {
  const map = offer?.stripe_price_env;
  if (map && typeof map === 'object' && map[region]) return map[region];
  if (offer?.id === 'COMMANDER-DECK-DIAGNOSTIC-001') return `STRIPE_PRICE_${region}`;
  return null;
}

function marketplaceCatalog() {
  const tracked = readCatalogProducts().filter(x => String(x.silo || '').toUpperCase() === 'B2B');
  const submitted = readJson('marketplace-listings.json', []).filter(x => x.state === 'APPROVED' && String(x.silo || '').toUpperCase() === 'B2B');
  return [...tracked, ...submitted];
}

function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function verifyPassword(password, salt, expected) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex'), target = Buffer.from(expected, 'hex');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}
function cookieToken(req) {
  const raw = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('dl_session='));
  return raw ? decodeURIComponent(raw.slice('dl_session='.length)) : '';
}
function currentUser(req) {
  const token = cookieToken(req); if (!token) return null;
  const sessions = readJson('sessions.json', {}), session = sessions[token];
  if (!session || session.expires_at < Date.now()) return null;
  const users = readJson('accounts.json', []); return users.find(u => u.id === session.user_id) || null;
}
function requireUser(req, res, next) { const u = currentUser(req); if (!u) return res.status(401).json({ error: 'authentication_required' }); req.user = u; next(); }
function safeUser(u) { return { id: u.id, email: u.email, display_name: u.display_name, silo: u.silo, created_at: u.created_at }; }

app.post('/api/account/register', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(), password = String(req.body?.password || ''), displayName = String(req.body?.display_name || req.body?.displayName || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
  if (password.length < 10) return res.status(400).json({ error: 'password_too_short', minimum: 10 });
  const users = readJson('accounts.json', []);
  if (users.some(u => u.email === email)) return res.status(409).json({ error: 'account_exists' });
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: crypto.randomUUID(), email, display_name: displayName || email.split('@')[0], silo: 'B2B', salt, password_hash: hashPassword(password, salt), created_at: new Date().toISOString() };
  users.push(user); writeJson('accounts.json', users);
  return createSession(res, user);
});
function createSession(res, user) {
  const sessions = readJson('sessions.json', {}), token = crypto.randomBytes(32).toString('base64url');
  sessions[token] = { user_id: user.id, expires_at: Date.now() + 1000 * 60 * 60 * 24 * 30 }; writeJson('sessions.json', sessions);
  res.setHeader('Set-Cookie', `dl_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return res.status(201).json({ ok: true, user: safeUser(user) });
}
app.post('/api/account/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(), password = String(req.body?.password || '');
  const user = readJson('accounts.json', []).find(u => u.email === email);
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) return res.status(401).json({ error: 'invalid_credentials' });
  return createSession(res, user);
});
app.post('/api/account/logout', (req, res) => { const token = cookieToken(req), sessions = readJson('sessions.json', {}); if (token) delete sessions[token]; writeJson('sessions.json', sessions); res.setHeader('Set-Cookie', 'dl_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/account/me', (req, res) => { const u = currentUser(req); if (!u) return res.status(401).json({ error: 'not_authenticated' }); res.json({ ok: true, user: safeUser(u) }); });

app.get('/api/marketplace/catalog', (req, res) => res.json({ silo: 'B2B', count: marketplaceCatalog().length, listings: marketplaceCatalog() }));
app.get('/api/marketplace/my-listings', requireUser, (req, res) => {
  const listings = readJson('marketplace-listings.json', []).filter(x => x.owner_id === req.user.id);
  res.json({ listings });
});
app.post('/api/marketplace/intake', requireUser, (req, res) => {
  const title = String(req.body?.title || '').trim(), description = String(req.body?.description || '').trim();
  const price = Number(req.body?.price), currency = String(req.body?.currency || 'NZD').trim().toUpperCase();
  if (title.length < 3 || description.length < 20) return res.status(400).json({ error: 'listing_content_too_short' });
  if (!Number.isFinite(price) || price <= 0 || price > 1000000) return res.status(400).json({ error: 'invalid_price' });
  if (!['NZD','USD','EUR','AUD','GBP'].includes(currency)) return res.status(400).json({ error: 'unsupported_currency' });
  const listings = readJson('marketplace-listings.json', []);
  const listing = { id: `B2B-${crypto.randomUUID()}`, object_type: 'sku_seed', silo: 'B2B', title, description, price, currency, owner_id: req.user.id, state: 'PENDING_APPROVAL', approval_required: true, checkout_available: false, created_at: new Date().toISOString() };
  listings.push(listing); writeJson('marketplace-listings.json', listings);
  res.status(201).json({ ok: true, listing, message: 'Listing received. It is not public or checkoutable until approved.' });
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return res.status(503).send('Stripe webhook is not configured');
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object;
    if (!s.livemode) { console.log('Ignoring test-mode session'); return res.json({ received: true, ignored: 'test_mode' }); }
    if (s.payment_status !== 'unpaid' || event.type === 'checkout.session.async_payment_succeeded') {
      ensureDirs(); fs.writeFileSync(path.join(PROOF_ROOT, 'FIRST_PAYMENT_PROOF.json'), JSON.stringify({ schema_version: 'BEC-FOSSIL-1.0', event: event.type, asset_id: s.metadata?.offer_id || s.client_reference_id || 'UNKNOWN', evidence_level: 1, status: 'PASS', amount: s.amount_total, currency: s.currency, transaction_id: s.id, payment_intent_id: s.payment_intent || null, timestamp_utc: new Date().toISOString() }, null, 2) + '\n', 'utf8');
    }
  }
  res.json({ received: true });
});
app.use(express.json({ limit: '1mb' }));
app.use('/static', express.static(path.join(ROOT, 'public')));
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', service: 'dreamledger', time_utc: new Date().toISOString() }));
app.get('/api/offers', (req, res) => res.json(publicOffers()));
app.get('/api/shared-assets/schema', (req, res) => res.sendFile(path.join(ROOT, 'assets', 'shared-asset-schema.json')));
app.get('/api/qr/:code/stats', (req, res) => res.json({ code: req.params.code, note: 'Scan logs are local to this service unless an external sink is configured.' }));
app.get('/api/proof/first-payment', (req, res) => { const f = path.join(PROOF_ROOT, 'FIRST_PAYMENT_PROOF.json'); if (!fs.existsSync(f)) return res.status(404).json({ status: 'NOT_FOUND', evidence: 'No live payment fossil has been observed.' }); res.type('application/json').send(fs.readFileSync(f, 'utf8')); });
async function qrResponse(req, res) { const url = `${QR_BASE_DOMAIN}/${encodeURIComponent(QR_CODE)}`; res.json({ code: QR_CODE, canonical_url: url, data_url: await QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 2, width: 1200 }) }); }
app.get('/api/qr/generate', qrResponse); app.post('/api/qr/generate', qrResponse);
app.get('/api/qr/:code.png', async (req, res) => { if (req.params.code !== QR_CODE) return res.status(404).end(); res.type('png').send(await QRCode.toBuffer(`${QR_BASE_DOMAIN}/${encodeURIComponent(QR_CODE)}`, { errorCorrectionLevel: 'H', margin: 2, width: 1200 })); });
app.get('/qr/:code', (req, res) => { if (req.params.code !== QR_CODE) return res.status(404).send('Unknown QR code'); const country = detectCountry(req), language = detectLanguage(req), region = regionFor(country), destination = `${BASE_URL}/${region.toLowerCase()}?lang=${encodeURIComponent(language)}`; try { logScan({ code: QR_CODE, scan_time: new Date().toISOString(), country, region, language, user_agent: req.get('user-agent') || '', destination_url: destination }); } catch (_) {} res.redirect(302, destination); });
app.get('/:region', (req, res, next) => { const region = String(req.params.region || '').toUpperCase(); if (!['NZ','US','EU','INTL'].includes(region)) return next(); const language = detectLanguage(req), t = languageMap[language] || languageMap.en, p = money(region), html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/__DL_HERO__/g, t.hero).replace(/__DL_SUB__/g, t.sub).replace(/__DL_CTA__/g, t.cta).replace(/__DL_PROOF__/g, t.proof).replace(/__DL_REGION__/g, region).replace(/__DL_PRICE__/g, `${p.currency.toUpperCase()} ${p.amount}`).replace(/__DL_LANG__/g, language).replace(/__DL_LANG__/g, language); res.set('Content-Language', language).send(html); });
app.post('/api/offer-checkout/create', async (req, res) => { try { const id = String(req.body?.offer_id || ''), offer = findOffer(id); if (!offer) return res.status(404).json({ error: 'unknown_offer' }); if (offer.approval_required || !offer.checkout_available) return res.status(403).json({ error: 'offer_not_approved', message: 'Checkout is disabled until the offer is explicitly approved.' }); if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'stripe_not_configured' }); const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY), requested = String(req.body?.region || '').toUpperCase(), region = ['NZ','US','EU','INTL'].includes(requested) ? requested : regionFor(String(req.body?.country || DEFAULT_COUNTRY).toUpperCase()), priceEnv = stripePriceEnvFor(offer, region), priceId = priceEnv ? process.env[priceEnv] : null; if (!priceId) return res.status(503).json({ error: 'price_not_configured', region, required_env: priceEnv || `offer-specific Stripe price mapping missing for ${id}` }); const s = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price: priceId, quantity: 1 }], client_reference_id: id, metadata: { offer_id: id, silo: offer.silo, region }, success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${BASE_URL}/${region.toLowerCase()}?cancelled=1` }); res.json({ url: s.url, session_id: s.id, offer_id: id, region }); } catch (_) { res.status(500).json({ error: 'checkout_create_failed' }); } });
app.get('/marketplace', (req, res) => res.sendFile(path.join(ROOT, 'marketplace.html')));
app.use((req, res, next) => { if (req.path === '/' || req.path === '/index.html') return res.sendFile(path.join(ROOT, 'index.html')); const map = { '/audits.html': 'audits.html', '/proofs.html': 'proofs.html', '/success.html': 'success.html', '/ip.html': 'ip.html', '/engine.html': 'engine.html', '/revenue.html': 'revenue.html', '/register.html': 'register.html', '/dreamiez/register.html': 'dreamiez/register.html', '/dreamiez/login.html': 'dreamiez/login.html', '/dreamiez/index.html': 'dreamiez/index.html', '/mtg': 'mtg.html', '/mtg.html': 'mtg.html', '/kelplantis.html': 'kelplantis.html' }; if (map[req.path]) return res.sendFile(path.join(ROOT, map[req.path])); next(); });
app.use((req, res) => res.status(404).send('Not found'));
app.listen(PORT, '0.0.0.0', () => console.log(`DreamLedger listening on ${PORT}`));
