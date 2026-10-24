'use strict';
// Review-only regression. All provider calls, credentials, and writes are synthetic mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const source = fs.readFileSync(path.join(__dirname, '..', 'ops', 'commerce', 'reconcile-stripe-airtable.mjs'), 'utf8');
const executable = source.replace(/^import fs from 'node:fs\\/promises';/, 'const fs = injectedFs;')
  .replace('console.log(JSON.stringify(proof, null, 2));', '// captured by mock');
assert.notEqual(executable, source, 'ESM fs import must be replaced');
async function scenario(paid, airtableEnabled) {
  let proof = null;
  const calls = [];
  const approved = { approved: [{ offer_id: 'SYNTHETIC_ONLY', product_id: 'SYNTHETIC',
    product_sku: 'SYNTHETIC', payment_link_url: 'https://buy.stripe.com/synthetic-test',
    price: 400, currency: 'NZD', payment_link_id: 'plink_synthetic', silo: 'mtg' }] };
  const mockFs = { readFile: async () => JSON.stringify(approved), mkdir: async () => {},
    writeFile: async (_path, content) => { proof = JSON.parse(content); } };
  const mockFetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: String(url), method, body: options.body || '' });
    let data;
    if (String(url).includes('/payment_links')) data = { data: [
      { id: 'plink_synthetic', url: 'https://buy.stripe.com/synthetic-test', livemode: true }], has_more: false };
    else if (String(url).includes('/checkout/sessions')) data = { data: paid ? [{
      id: 'cs_synthetic', payment_link: 'plink_synthetic', payment_status: 'paid',
      currency: 'nzd', amount_total: 40000, livemode: true, created: 1792800000
    }] : [], has_more: false };
    else if (method === 'POST') data = { records: [{ id: 'rec_synthetic' }] };
    else data = { records: [] };
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  const env = { STRIPE_SECRET_KEY: 'synthetic_nonreal',
    STRIPE_PAYMENT_LINK_URL: 'https://buy.stripe.com/synthetic-test',
    STRIPE_LIVE_ENABLED: 'true' };
  if (airtableEnabled) Object.assign(env, { AIRTABLE_TOKEN: 'synthetic_nonreal',
    AIRTABLE_BASE_ID: 'app_synthetic', AIRTABLE_EVENTS_TABLE_ID: 'tbl_events',
    AIRTABLE_OFFERS_TABLE_ID: 'tbl_offers', AIRTABLE_OFFER_RECORD_ID: 'rec_offer' });
  await new AsyncFunction('injectedFs', 'fetch', 'process', 'URLSearchParams', executable)(
    mockFs, mockFetch, { env }, URLSearchParams);
  return { proof, calls };
}
(async () => {
  const a = await scenario(true, true);
  assert.equal(a.proof.matching_paid_sessions, 1);
  assert.equal(a.proof.observed_paid_session_amount_nzd, 400);
  assert.equal(a.proof.verified_revenue_nzd, 0);
  assert.equal(a.proof.verified_external_revenue_nzd, null);
  assert.equal(a.proof.gauntlet, 'HOLD');
  assert.equal(a.proof.delivery_status, 'NOT_VERIFIED');
  assert.equal(a.proof.settlement_status, 'NOT_VERIFIED');
  assert.equal(a.calls.some(c => c.method === 'PATCH'), false);
  const event = a.calls.find(c => c.method === 'POST');
  assert.ok(event, 'Airtable may index a pending observation');
  assert.equal(JSON.parse(event.body).records[0].fields.Verified, false);
  assert.equal(JSON.parse(event.body).records[0].fields['Gauntlet Verdict'], 'HOLD');
  const b = await scenario(false, true);
  assert.equal(b.proof.observed_paid_session_amount_nzd, 0);
  assert.equal(b.proof.newly_recognized_events.length, 0);
  const c = await scenario(true, false);
  assert.equal(c.proof.airtable_sync, 'NOT_AVAILABLE');
  assert.equal(c.proof.verified_revenue_nzd, 0);
  assert.equal(c.calls.some(x => x.method === 'POST' || x.method === 'PATCH'), false);
  console.log('PASS 16/16 synthetic settlement truth regression assertions');
})().catch(e => { console.error(e); process.exitCode = 1; });
