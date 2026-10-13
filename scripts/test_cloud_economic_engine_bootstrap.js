'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { probeSupabase, probeStripe, safeFetch, runBootstrap } = require('./cloud_economic_engine_bootstrap');

async function main() {
  const noDb = await probeSupabase({}, async () => { throw new Error('must not fetch without credentials'); });
  assert.equal(noDb.status, 'UNVERIFIED_NO_CREDENTIALS');
  const noStripe = await probeStripe({}, async () => { throw new Error('must not fetch without credentials'); });
  assert.equal(noStripe.status, 'UNVERIFIED_NO_CREDENTIALS');

  const dbMethods = [];
  const db = await probeSupabase(
    { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only' },
    async (url, options = {}) => {
      dbMethods.push(String(options.method || 'GET'));
      return new Response('', { status: 200 });
    },
  );
  assert.equal(db.status, 'PASS');
  assert.ok(dbMethods.every(method => method === 'HEAD'));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-bootstrap-'));
  const reportPath = path.join(tempDir, 'commissioning-report.json');
  const publicReport = await runBootstrap({
    mode: 'public-only',
    env: {},
    reportPath,
    fetchImpl: async url => new Response('', { status: 200, headers: { 'content-type': 'text/plain' } }),
  });
  assert.equal(publicReport.status, 'PUBLIC_SURFACES_PASS_COMMERCE_UNVERIFIED');
  assert.equal(publicReport.economic_truth.verified_external_revenue_nzd, 0);
  assert.ok(fs.existsSync(reportPath));

  const methods = [];
  const mockFetch = async (url, options = {}) => {
    methods.push(String(options.method || 'GET'));
    if (String(url).includes('/webhook_endpoints')) return new Response(JSON.stringify({ data: [
      { id: 'we_disabled', url: 'https://example.supabase.co/functions/v1/stripe-revenue-41104f355d6878cdd6d1f9dc', status: 'disabled', disabled_reason: null, enabled_events: ['checkout.session.completed'] }
    ]}), { status: 200, headers: { 'content-type': 'application/json' } });
    if (String(url).includes('/payment_links')) return new Response(JSON.stringify({ data: [
      { id: 'plink_1UKS00EGgEAnUFF9kUjraaL5', active: true, url: 'https://buy.stripe.com/example' }
    ]}), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('', { status: 200 });
  };
  const stripe = await probeStripe({ STRIPE_SECRET_KEY: 'sk_live_fixture_only' }, mockFetch);
  assert.equal(stripe.canonical_revenue_webhook, 'DISABLED');
  assert.equal(stripe.commander_payment_link, 'ACTIVE');
  assert.equal(stripe.status, 'BLOCKED');
  assert.ok(methods.every(method => method === 'GET'));
  await assert.rejects(safeFetch('https://example.com', { method: 'POST' }, async () => new Response('', { status: 200 })), /READ_ONLY_METHOD_BLOCKED/);
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, 'cloud_economic_engine_bootstrap.js'), 'utf8');
  assert.match(source, /PUBLIC_SURFACES_PASS_COMMERCE_UNVERIFIED/);
  console.log('PASS: bootstrap probe is read-only and keeps missing/disabled commerce infrastructure blocked.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
