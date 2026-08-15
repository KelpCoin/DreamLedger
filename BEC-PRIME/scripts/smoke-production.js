'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = (process.env.SMOKE_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const OFFER_ID = 'OFFER-BEC-PRIME-ARCHITECTURE-AUDIT';
const PRODUCT_ID = 'BEC-PRIME-ARCHITECTURE-AUDIT-001';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'follow', cache: 'no-store', ...options });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) {}
  return { response, text, body };
}

(async () => {
  const health = await request('/healthz');
  assert.equal(health.response.status, 200, `healthz HTTP ${health.response.status}`);
  assert.equal(health.body?.status, 'ok', 'healthz status must be ok');

  const loginPage = await request('/login.html');
  assert.equal(loginPage.response.status, 200, `login page HTTP ${loginPage.response.status}`);
  assert.match(loginPage.text, /\/api\/account\/login/, 'login page must use canonical account login API');
  assert.match(loginPage.text, /\/api\/account\/me/, 'login page must use canonical account session API');

  const smokeEmail = `production-login-${crypto.randomUUID()}@example.test`;
  const smokePassword = 'DreamLedgerProduction!2026';
  const created = await request('/api/account/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: smokeEmail, password: smokePassword, name: 'Production Login Smoke' })
  });
  assert.equal(created.response.status, 201, `account registration HTTP ${created.response.status}`);
  assert.equal(created.body?.ok, true, 'production account registration must succeed');
  const cookie = created.response.headers.get('set-cookie');
  assert.ok(cookie && cookie.includes('dreamiez_session='), 'registration must return a Dreamiez session cookie');

  const session = await request('/api/account/me', { headers: { cookie } });
  assert.equal(session.response.status, 200, 'account session probe must return HTTP 200');
  assert.equal(session.body?.authenticated, true, 'registered production account must be authenticated');
  assert.equal(session.body?.account?.email, smokeEmail, 'registered account email must round-trip');

  const login = await request('/api/account/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: smokeEmail, password: smokePassword })
  });
  assert.equal(login.response.status, 200, `production login HTTP ${login.response.status}`);
  assert.equal(login.body?.ok, true, 'production login must succeed');
  const loginCookie = login.response.headers.get('set-cookie');
  assert.ok(loginCookie && loginCookie.includes('dreamiez_session='), 'login must return a Dreamiez session cookie');

  const loggedIn = await request('/api/account/me', { headers: { cookie: loginCookie } });
  assert.equal(loggedIn.body?.authenticated, true, 'login session must authenticate');
  assert.equal(loggedIn.body?.account?.email, smokeEmail, 'login session must restore the same account');

  const badLogin = await request('/api/account/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: smokeEmail, password: 'wrong-password' })
  });
  assert.equal(badLogin.response.status, 401, 'invalid production password must be rejected');

  const offers = await request('/api/offers');
  assert.equal(offers.response.status, 200, `offers HTTP ${offers.response.status}`);
  const offerList = offers.body?.offers || [];
  assert.ok(Array.isArray(offerList), 'offers must be an array');
  const audit = offerList.find(o => o.offer_id === OFFER_ID);
  assert.ok(audit, `approved offer ${OFFER_ID} must be public`);
  assert.equal(audit.checkout_available, true, 'approved offer must be checkoutable');
  assert.equal(audit.approval_required, false, 'approved offer must be ungated');
  assert.equal(Number(audit.price), 49, 'approved offer price must be NZD 49.00');
  assert.equal(String(audit.currency).toLowerCase(), 'nzd', 'approved offer currency must be NZD');

  const products = await request('/api/products');
  assert.equal(products.response.status, 200, `products HTTP ${products.response.status}`);
  const list = products.body?.products || [];
  assert.ok(Array.isArray(list), 'products must be an array');
  const publicAudit = list.find(p => p.id === PRODUCT_ID);
  assert.ok(publicAudit, `approved product ${PRODUCT_ID} must be public`);
  assert.equal(publicAudit.checkout_available, true, 'approved product must be checkoutable');
  assert.equal(publicAudit.price, 4900, 'approved product price must be NZD 49.00 in cents');
  assert.equal(String(publicAudit.currency).toLowerCase(), 'nzd', 'approved product currency must be NZD');
  assert.equal(publicAudit.commercial_truth?.approval_required, false, 'approved product must not remain approval-gated');

  const home = await request('/');
  assert.equal(home.response.status, 200, `home HTTP ${home.response.status}`);
  assert.match(home.text, /One commerce engine\. Many worlds\./i, 'home must use CUBE-first positioning');
  assert.match(home.text, /BEC-PRIME Architecture Audit/i, 'home must expose the approved first-sale offer');
  assert.doesNotMatch(home.text, /magic the gathering|mtg shop|commander deck/i, 'master surface must not be MTG-branded');

  console.log(JSON.stringify({
    status: 'PASS',
    base,
    production_login: true,
    invalid_login_rejected: true,
    first_sale_offer: { id: audit.offer_id, price: audit.price, currency: audit.currency, checkout_available: audit.checkout_available },
    first_sale_product: { id: publicAudit.id, price: publicAudit.price, currency: publicAudit.currency, checkout_available: publicAudit.checkout_available },
    checkoutable_products: list.filter(p => p.checkout_available).map(p => ({ id: p.id, price: p.price, currency: p.currency }))
  }, null, 2));
})().catch(err => {
  console.error(JSON.stringify({ status: 'FAIL', base, error: err.message }, null, 2));
  process.exit(1);
});
