'use strict';

const assert = require('node:assert/strict');
const base = (process.env.SMOKE_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
async function get(path) { const response = await fetch(`${base}${path}`, { redirect: 'follow', cache: 'no-store' }); const text = await response.text(); let body = null; try { body = JSON.parse(text); } catch (_) {} return { response, text, body }; }
(async () => {
  const health = await get('/healthz');
  assert.equal(health.response.status, 200, `healthz HTTP ${health.response.status}`);
  assert.equal(health.body?.status, 'ok', 'healthz status must be ok');

  const offers = await get('/api/offers');
  assert.equal(offers.response.status, 200, `offers HTTP ${offers.response.status}`);
  const offerList = offers.body?.offers || [];
  assert.ok(Array.isArray(offerList), 'offers must be an array');
  const audit = offerList.find(o => o.offer_id === 'AGENTIC-COMMERCE-READINESS-001');
  assert.ok(audit, 'general paid audit offer must be public');
  assert.equal(audit.checkout_available, true, 'general paid audit must be checkoutable');
  assert.equal(audit.approval_required, false, 'general paid audit must be ungated');

  const products = await get('/api/products');
  assert.equal(products.response.status, 200, `products HTTP ${products.response.status}`);
  const list = products.body?.products || [];
  assert.ok(Array.isArray(list), 'products must be an array');
  const publicAudit = list.find(p => p.id === 'AGENTIC-COMMERCE-READINESS-001');
  assert.ok(publicAudit, 'general paid audit product must be public');
  assert.equal(publicAudit.checkout_available, true, 'general paid audit product must be checkoutable');
  assert.equal(publicAudit.price, 4900, 'general paid audit price must be NZD 49.00');
  assert.equal(String(publicAudit.currency).toLowerCase(), 'nzd', 'general paid audit currency must be NZD');

  const home = await get('/');
  assert.equal(home.response.status, 200, `home HTTP ${home.response.status}`);
  assert.match(home.text, /One commerce engine\. Many worlds\./i, 'home must use CUBE-first positioning');
  assert.match(home.text, /Agentic Commerce Readiness Audit/i, 'home must expose the first-sale offer');
  assert.doesNotMatch(home.text, /magic the gathering|mtg shop|commander deck/i, 'master surface must not be MTG-branded');

  console.log(JSON.stringify({
    status: 'PASS',
    base,
    healthz: health.body,
    first_sale_offer: { id: audit.offer_id, price: audit.price, currency: audit.currency, checkout_available: audit.checkout_available },
    checkoutable_products: list.filter(p => p.checkout_available).map(p => ({ id: p.id, price: p.price, currency: p.currency }))
  }, null, 2));
})().catch(err => { console.error(JSON.stringify({ status: 'FAIL', base, error: err.message }, null, 2)); process.exit(1); });
