'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const kernel = require('../routes/marketplaceKernel');

function makeResponse() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writableEnded: false,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
      return this;
    },
    end(body) {
      this.body = String(body == null ? '' : body);
      this.writableEnded = true;
      return this;
    }
  };
}

async function request(path, method = 'GET') {
  const res = makeResponse();
  const handled = await kernel.handle({
    method,
    url: path,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' }
  }, res, path);
  return { handled, res };
}

(async () => {
  const verticalResponse = await request('/api/marketplace/v1/verticals');
  assert.equal(verticalResponse.handled, true, 'priority vertical route must be handled');
  assert.equal(verticalResponse.res.statusCode, 200, 'valid vertical contract should return HTTP 200');
  const contract = JSON.parse(verticalResponse.res.body);
  assert.equal(contract.schema, 'dreamledger.marketplace.priority-verticals.v1');
  assert.equal(contract.commercial_verticals.length, 3);
  const truth = contract.commercial_verticals.find(v => v.id === 'truth-oracle-paid-evidence-review');
  const meez = contract.commercial_verticals.find(v => v.id === 'dreammeez-avatar-cosmetics');
  const dooh = contract.commercial_verticals.find(v => v.id === 'programmatic-dooh-billboard');
  assert.ok(truth && meez && dooh, 'all priority verticals must be present');
  assert.equal(truth.standalone_audit_sku_allowed, false);
  assert.equal(truth.new_product_price_or_payment_link_allowed_by_this_contract, false);
  assert.equal(truth.checkout_enabled, false);
  assert.equal(truth.surface_state, 'PROPOSED_NOT_LIVE');
  assert.equal(meez.checkout_enabled, false);
  assert.equal(meez.no_browser_side_ownership_grants, true);
  assert.equal(dooh.checkout_enabled, false);
  assert.equal(dooh.current_surface_is_web_native, true, 'current public billboard must be described as web-native');
  assert.equal(dooh.physical_dooh_integration, 'NOT_PRESENT', 'physical DOOH must not be claimed integrated');
  assert.equal(dooh.physical_inventory_verified, false, 'physical inventory must remain unverified');
  assert.equal(new Set(contract.commercial_verticals.map(v => v.silo_id)).size, 3, 'vertical silo IDs must be distinct');
  assert.equal(contract.economic_validation.verified_external_revenue_nzd, 0);

  const discovery = await request('/api/marketplace/v1/discovery');
  assert.equal(discovery.handled, true, 'discovery route must be handled');
  assert.equal(discovery.res.statusCode, 200);
  const discoveryBody = JSON.parse(discovery.res.body);
  assert.equal(discoveryBody.endpoints.verticals, '/api/marketplace/v1/verticals');
  assert.ok(discoveryBody.capabilities.includes('priority_vertical_discovery'));

  const originalReadFileSync = fs.readFileSync;
  try {
    fs.readFileSync = function (filePath, ...args) {
      if (String(filePath).replace(/\\/g, '/').endsWith('/catalog/marketplace/priority-verticals.v1.json')) {
        const err = new Error('fixture: priority vertical registry missing');
        err.code = 'ENOENT';
        throw err;
      }
      return originalReadFileSync.call(this, filePath, ...args);
    };
    const failedClosed = await request('/api/marketplace/v1/verticals');
    assert.equal(failedClosed.handled, true);
    assert.equal(failedClosed.res.statusCode, 503, 'missing registry must fail closed');
    const failureBody = JSON.parse(failedClosed.res.body);
    assert.equal(failureBody.record_state, 'UNAVAILABLE_FAIL_CLOSED');
    assert.equal(failureBody.checkout_enabled, false);
  } finally {
    fs.readFileSync = originalReadFileSync;
  }

  const unknown = await request('/api/marketplace/v1/not-a-route');
  assert.equal(unknown.handled, true, 'marketplace API prefix is handled by the kernel');
  assert.equal(unknown.res.statusCode, 404, 'unknown marketplace API path must return a controlled 404');

  console.log(JSON.stringify({
    status: 'PASS_PRIORITY_VERTICAL_RUNTIME_CONTRACT',
    assertions: 27,
    priority_verticals: 3,
    checkout_authorized: 0,
    failure_mode: 'UNAVAILABLE_FAIL_CLOSED',
    economic_validation: 'NOT_ECONOMICALLY_VALIDATED'
  }, null, 2));
})().catch(err => {
  console.error(JSON.stringify({
    status: 'FAIL_PRIORITY_VERTICAL_RUNTIME_CONTRACT',
    error: err && err.message ? err.message : String(err)
  }, null, 2));
  process.exitCode = 1;
});
