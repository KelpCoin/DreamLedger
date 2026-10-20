'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handleBuyRoute, publicSafeProduct } = require('./buy-route');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-buy-route-'));
const cataloguePath = path.join(root, 'catalog.json');
const readyProduct = {
  id: 'DREAMMEEZ-EXAMPLE-001',
  sku: 'EXAMPLE-001',
  status: 'published',
  checkout_available: true,
  checkout_url: 'https://buy.stripe.com/example',
  payment_link_status: 'ACTIVE',
  checkout_verification_status: 'VERIFIED',
  fulfillment_test_status: 'VERIFIED'
};

function writeCatalogue(products) {
  fs.writeFileSync(cataloguePath, JSON.stringify({ products }, null, 2));
}
function request(pathname, method = 'GET') {
  const headers = {};
  let body;
  const res = {
    statusCode: 200,
    writableEnded: false,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(value) { body = value; this.writableEnded = true; }
  };
  const handled = handleBuyRoute({ method }, res, pathname, root);
  return { handled, status: res.statusCode, headers, body };
}

assert.equal(request('/status').handled, false, 'non-buy requests are not intercepted');
writeCatalogue([readyProduct]);
const ready = request('/buy/example-001');
assert.equal(ready.handled, true);
assert.equal(ready.status, 302);
assert.equal(ready.headers.location, readyProduct.checkout_url);
assert.equal(ready.headers['cache-control'], 'no-store');
assert.equal(publicSafeProduct(readyProduct).checkout_url, readyProduct.checkout_url,
  'verified product may expose the allowlisted link');

const hidden = publicSafeProduct({ ...readyProduct, fulfillment_test_status: 'UNVERIFIED' });
assert.equal(hidden.checkout_available, false);
assert.equal(hidden.checkout_url, null, 'unverified links must not leak through the public catalogue');

writeCatalogue([{ ...readyProduct, payment_link_status: 'INACTIVE' }]);
assert.equal(request('/buy/EXAMPLE-001').status, 503, 'inactive Stripe links are held');

writeCatalogue([{ ...readyProduct, fulfillment_test_status: 'UNVERIFIED' }]);
assert.equal(request('/buy/EXAMPLE-001').status, 503, 'unverified delivery is held');

writeCatalogue([{ ...readyProduct, checkout_url: 'https://example.com/checkout' }]);
assert.equal(request('/buy/EXAMPLE-001').status, 503, 'non-Stripe redirects are rejected');

writeCatalogue([]);
assert.equal(request('/buy/UNKNOWN').status, 404, 'unknown SKU is not redirected');
assert.equal(request('/buy/EXAMPLE-001', 'POST').status, 405, 'non-read methods are rejected');

fs.rmSync(root, { recursive: true, force: true });
console.log('BUY_ROUTE_GATE=PASS');
console.log('RULES=ACTIVE_LINK+CHECKOUT_VERIFIED+FULFILLMENT_VERIFIED+ALLOWLISTED_STRIPE_HOST');
