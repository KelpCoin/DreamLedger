'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = (process.env.SMOKE_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const PRODUCT_ID = 'COMMANDER-DECK-DIAGNOSTIC-001';
const OFFER_ID = 'COMMANDER-DECK-DIAGNOSTIC-001';

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}${path}`, { redirect: 'follow', cache: 'no-store', signal: controller.signal, ...options });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch (_) {}
    return { response, text, body };
  } finally { clearTimeout(timer); }
}

(async () => {
  const health = await request('/healthz');
  assert.equal(health.response.status, 200, `healthz HTTP ${health.response.status}`);
  assert.equal(health.body?.status, 'ok', 'healthz status must be ok');

  const loginPage = await request('/login.html');
  assert.equal(loginPage.response.status, 200, `login page HTTP ${loginPage.response.status}`);
  assert.match(loginPage.text, /\/api\/dreamiez\/account\/login/);
  assert.match(loginPage.text, /\/api\/dreamiez\/me/);
  assert.doesNotMatch(loginPage.text, /if\(j\.authenticated\)location\.href/);
  assert.doesNotMatch(loginPage.text, /if\s*\(j\.authenticated\)\s*location\.href/);

  const smokeEmail = `production-login-${crypto.randomUUID()}@example.test`;
  const smokePassword = 'DreamLedgerProduction!2026';
  const created = await request('/api/dreamiez/account/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: smokeEmail, password: smokePassword, name: 'Production Login Smoke' }) });
  assert.equal(created.response.status, 201, `account registration HTTP ${created.response.status}`);
  assert.equal(created.body?.ok, true);
  const cookie = created.response.headers.get('set-cookie');
  assert.ok(cookie && cookie.includes('dreamiez_session='));
  const session = await request('/api/dreamiez/me', { headers: { cookie } });
  assert.equal(session.response.status, 200);
  assert.equal(session.body?.authenticated, true);
  assert.equal(session.body?.account?.email, smokeEmail);

  const login = await request('/api/dreamiez/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: smokeEmail, password: smokePassword }) });
  assert.equal(login.response.status, 200, `production login HTTP ${login.response.status}`);
  assert.equal(login.body?.ok, true);
  const loginCookie = login.response.headers.get('set-cookie');
  assert.ok(loginCookie && loginCookie.includes('dreamiez_session='));
  const loggedIn = await request('/api/dreamiez/me', { headers: { cookie: loginCookie } });
  assert.equal(loggedIn.body?.authenticated, true);
  assert.equal(loggedIn.body?.account?.email, smokeEmail);

  const badLogin = await request('/api/dreamiez/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: smokeEmail, password: 'wrong-password' }) });
  assert.equal(badLogin.response.status, 401);

  const offers = await request('/api/offers');
  assert.equal(offers.response.status, 200);
  const audit = (offers.body?.offers || []).find(o => o.offer_id === OFFER_ID);
  assert.ok(audit);
  assert.equal(audit.checkout_available, true);
  assert.equal(audit.approval_required, false);
  assert.equal(Number(audit.price), 25);
  assert.equal(String(audit.currency).toLowerCase(), 'nzd');

  const products = await request('/api/products');
  assert.equal(products.response.status, 200);
  const publicAudit = (products.body?.products || []).find(p => p.id === PRODUCT_ID);
  assert.ok(publicAudit);
  assert.equal(publicAudit.checkout_available, true);
  assert.equal(publicAudit.price, 2500);
  assert.equal(String(publicAudit.currency).toLowerCase(), 'nzd');
  assert.equal(publicAudit.approval_required, false);

  console.log(JSON.stringify({ status: 'PASS', base, production_login: true, invalid_login_rejected: true, checkout_offer: { id: audit.offer_id, price: audit.price, currency: audit.currency, checkout_available: audit.checkout_available }, checkout_product: { id: publicAudit.id, price: publicAudit.price, currency: publicAudit.currency, checkout_available: publicAudit.checkout_available } }, null, 2));
})().catch(err => { console.error(JSON.stringify({ status: 'FAIL', base, error: err.name === 'AbortError' ? 'request timeout after 15s' : err.message }, null, 2)); process.exit(1); });
