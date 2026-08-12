'use strict';

const assert = require('node:assert/strict');
const base = (process.env.SMOKE_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
async function get(path) { const response = await fetch(`${base}${path}`, { redirect: 'follow', cache: 'no-store' }); const text = await response.text(); let body = null; try { body = JSON.parse(text); } catch (_) {} return { response, text, body }; }
(async () => {
  const health = await get('/healthz');
  assert.equal(health.response.status, 200, `healthz HTTP ${health.response.status}`);
  assert.equal(health.body?.status, 'ok', 'healthz status must be ok');
  const products = await get('/api/products');
  assert.equal(products.response.status, 200, `products HTTP ${products.response.status}`);
  const list = products.body?.products || [];
  assert.ok(Array.isArray(list), 'products must be an array');
  for (const [id, price] of [['COMMANDER-DECK-DIAGNOSTIC-001', 1500], ['EDH_0001', 40000]]) {
    const product = list.find(p => p.id === id);
    assert.ok(product, `${id} must be public`);
    assert.equal(product.checkout_available, true, `${id} must be checkoutable`);
    assert.equal(product.price, price, `${id} price mismatch`);
  }
  const offers = await get('/api/offers');
  assert.equal(offers.response.status, 200, `offers HTTP ${offers.response.status}`);
  const offerList = offers.body?.offers || [];
  assert.ok(Array.isArray(offerList), 'offers must be an array');
  for (const id of ['COMMANDER-DECK-DIAGNOSTIC-001', 'EDH_0001']) assert.ok(offerList.some(o => o.offer_id === id && o.checkout_available === true), `${id} offer must be checkoutable`);
  console.log(JSON.stringify({ status: 'PASS', base, healthz: health.body, checkoutable_products: list.filter(p => p.checkout_available).map(p => ({ id: p.id, price: p.price, currency: p.currency })) }, null, 2));
})().catch(err => { console.error(JSON.stringify({ status: 'FAIL', base, error: err.message }, null, 2)); process.exit(1); });
