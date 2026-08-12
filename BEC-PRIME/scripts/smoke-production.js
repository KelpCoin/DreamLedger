'use strict';

const assert = require('node:assert/strict');
const base = (process.env.SMOKE_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');

async function get(path) {
  const response = await fetch(`${base}${path}`, { redirect: 'follow', cache: 'no-store' });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) {}
  return { response, text, body };
}

(async () => {
  const health = await get('/healthz');
  assert.equal(health.response.status, 200, `healthz HTTP ${health.response.status}`);
  assert.equal(health.body?.status, 'ok', 'healthz status must be ok');

  const products = await get('/api/products');
  assert.equal(products.response.status, 200, `products HTTP ${products.response.status}`);
  assert.ok(Array.isArray(products.body?.products), 'products must be an array');

  const diagnostic = products.body.products.find(p => p.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.ok(diagnostic, 'Commander Deck Diagnostic must be public');
  assert.equal(diagnostic.checkout_available, true, 'Commander Deck Diagnostic must be checkoutable');
  assert.equal(diagnostic.price, 1500, 'Commander Deck Diagnostic price must be NZD 15.00 minor units');

  const offers = await get('/api/offers');
  assert.equal(offers.response.status, 200, `offers HTTP ${offers.response.status}`);
  assert.ok(Array.isArray(offers.body?.offers), 'offers must be an array');

  const offer = offers.body.offers.find(o => o.offer_id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.ok(offer, 'Commander Deck Diagnostic offer must be public');
  assert.equal(offer.checkout_available, true, 'Diagnostic offer must be checkoutable');

  console.log(JSON.stringify({
    status: 'PASS',
    base,
    healthz: health.body,
    diagnostic: {
      id: diagnostic.id,
      price: diagnostic.price,
      currency: diagnostic.currency,
      checkout_available: diagnostic.checkout_available
    },
    offer: {
      offer_id: offer.offer_id,
      checkout_available: offer.checkout_available
    }
  }, null, 2));
})().catch(err => {
  console.error(JSON.stringify({ status: 'FAIL', base, error: err.message }, null, 2));
  process.exit(1);
});
