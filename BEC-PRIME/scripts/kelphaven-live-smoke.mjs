#!/usr/bin/env node
import process from 'node:process';

const baseUrl = String(process.argv[2] || process.env.KELPHAVEN_BASE_URL || 'https://dreamledger.org').replace(/\/+$/, '');
const checks = [];
async function check(name, route, opts = {}) {
  try {
    const response = await fetch(baseUrl + route, {
      method: opts.method || 'GET',
      headers: { accept: opts.json ? 'application/json' : 'text/html,application/json;q=0.9,*/*;q=0.8', ...(opts.body ? { 'content-type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = await response.text();
    let parsed = null;
    if (opts.json) {
      try { parsed = JSON.parse(payload); } catch { /* report failure without echoing response body */ }
    }
    const pass = response.status >= 200 && response.status < 300 &&
      (opts.json ? contentType.includes('application/json') && parsed !== null && (!opts.validate || opts.validate(parsed))
                 : contentType.includes('text/html') && payload.toLowerCase().includes(String(opts.contains || '').toLowerCase()));
    checks.push({
      name, route, status: response.status, content_type: contentType || null,
      verdict: pass ? 'PASS' : 'FAIL',
      reason: pass ? null : (response.status < 200 || response.status >= 300
        ? 'NON_2XX_HTTP_STATUS'
        : opts.json && parsed === null ? 'EXPECTED_JSON_RESPONSE'
        : !opts.json && !contentType.includes('text/html') ? 'EXPECTED_HTML_RESPONSE'
        : 'EXPECTED_CONTENT_MISSING')
    });
  } catch (error) {
    checks.push({ name, route, status: null, content_type: null, verdict: 'FAIL', reason: error?.name === 'TimeoutError' ? 'REQUEST_TIMEOUT' : 'NETWORK_OR_FETCH_ERROR' });
  }
}

await check('b2b_customer_surface', '/b2b-marketplace.html', { contains: 'KELPHAVEN' });
await check('a2a_customer_surface', '/a2a-marketplace.html', { contains: 'KELPHAVEN.N' });
await check('unified_marketplace_surface', '/marketplace.html', { contains: 'Kelphaven.n' });
await check('b2b_listing_search', '/api/b2b/search', { json: true, validate: value => value?.schema === 'DREAMLEDGER/B2B-SEARCH/v1' && Array.isArray(value.items) });
await check('b2b_rfq_discovery', '/api/b2b/rfqs', { json: true, validate: value => value?.schema === 'DREAMLEDGER/B2B-RFQ/v1' && Array.isArray(value.items) });
await check('a2a_manifest', '/m2m/v1/marketplace/manifest', { json: true, validate: value => value?.schema === 'dreamledger.a2a-marketplace.manifest.v1' && value?.name === 'Kelphaven.n B2B + A2A Marketplace' });
await check('a2a_capability_discovery', '/m2m/v1/marketplace/capabilities', { json: true, validate: value => value?.schema === 'dreamledger.a2a.capabilities.v1' && Array.isArray(value.capabilities) });
await check('a2a_search_read_only', '/m2m/v1/marketplace/search', { method: 'POST', json: true, body: { query: '' }, validate: value => value?.schema === 'dreamledger.a2a.search.v1' && Array.isArray(value.capabilities) });

const failed = checks.filter(item => item.verdict !== 'PASS');
const report = {
  schema: 'kelphaven/live-read-only-smoke/v1',
  base_url: baseUrl,
  verdict: failed.length ? 'FAIL' : 'PASS_READ_ONLY_SURFACES',
  checks_passed: checks.length - failed.length,
  checks_total: checks.length,
  checks,
  scope: {
    read_only_pages_and_discovery_only: true,
    checkout_and_payment: 'NOT_TESTED',
    independent_settlement: 'NOT_TESTED',
    fulfillment_and_delivery_receipt: 'NOT_TESTED',
    refunds_and_disputes: 'NOT_TESTED',
    explanation: 'A passing read-only smoke test is not a 100% end-to-end transaction test. No order, payment, message, publication or production state was mutated.'
  }
};
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
