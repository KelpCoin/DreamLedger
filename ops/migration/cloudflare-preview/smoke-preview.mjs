#!/usr/bin/env node
/**
 * Probe a deployed Cloudflare Pages preview. It deliberately refuses non-pages.dev
 * URLs and never treats the static preview as production readiness.
 */
import fs from 'node:fs';
import path from 'node:path';

const baseRaw = String(process.env.CLOUDFLARE_PREVIEW_URL || '').trim();
const expectedSha = String(process.env.GITHUB_SHA || '').trim();
const output = process.env.MIGRATION_PROOF_PATH || 'proof/migration/cloudflare-preview-route-probe.json';
const started = new Date().toISOString();
let base = null;
try {
  const u = new URL(baseRaw);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.pages.dev') || u.username || u.password) {
    throw new Error('Preview URL must be HTTPS on a *.pages.dev hostname');
  }
  base = u.origin;
} catch (e) {
  const proof = {
    schema: 'dreamledger/cloudflare-preview-route-probe/v1',
    status: 'BLOCKED_INVALID_PREVIEW_URL',
    observed_at_utc: started,
    expected_commit_sha: expectedSha || null,
    preview_origin: null,
    routes: [],
    production_ready: false,
    dns_changed: false,
    production_mutation: false,
    verified_revenue_nzd: 0,
    error: String(e?.message || 'Invalid preview URL')
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
  process.exit(2);
}

const checks = [
  { path: '/', status: 200, type: 'html', marker: /DreamLedger|Dream Ledger/i },
  { path: '/mtg/', status: 200, type: 'html', marker: /Magic|MTG|Sell singles/i },
  { path: '/truth-oracle.html', status: 200, type: 'html' },
  { path: '/silos/mtg/silo.json', status: 200, type: 'json' },
  { path: '/data/mtg-catalog.json', status: 200, type: 'json' },
  { path: '/healthz', status: 200, type: 'json', validate: b =>
    b.status === 'DEGRADED_STATIC_PREVIEW' && b.ready === false && b.production_ready === false },
  { path: '/version', status: 200, type: 'json', validate: b =>
    Boolean(expectedSha) && b.commit_sha === expectedSha && b.production_ready === false },
  { path: '/api/products', status: 200, type: 'json', validate: b =>
    b.schema === 'dreamledger/products/v1' && Array.isArray(b.products) },
  { path: '/api/offers', status: 200, type: 'json', validate: b =>
    b.schema === 'dreamledger/offers/v1' && Array.isArray(b.offers) },
  { path: '/api/toll/v1/manifest', status: 503, type: 'json', validate: b =>
    b.status === 'BLOCKED_ROUTE_NOT_MIGRATED' && b.production_ready === false },
  { path: '/api/webhooks/stripe', status: 503, type: 'json', validate: b =>
    b.status === 'BLOCKED_ROUTE_NOT_MIGRATED' && b.production_ready === false }
];

async function checkRoute(spec) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(base + spec.path, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: spec.type === 'json' ? 'application/json' : 'text/html' }
    });
    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();
    let body = null;
    let jsonValid = true;
    if (spec.type === 'json') {
      try { body = JSON.parse(bodyText); } catch { jsonValid = false; }
    }
    const contentTypeOk = spec.type === 'json' ? /application\/json/i.test(contentType) : /text\/html/i.test(contentType);
    const markerOk = !spec.marker || spec.marker.test(bodyText);
    const contractOk = !spec.validate || (jsonValid && spec.validate(body));
    const ok = response.status === spec.status && contentTypeOk && markerOk && contractOk;
    return {
      path: spec.path,
      expected_status: spec.status,
      actual_status: response.status,
      content_type_ok: contentTypeOk,
      json_valid: spec.type !== 'json' || jsonValid,
      body_contract_ok: contractOk,
      marker_ok: markerOk,
      result: ok ? 'PASS' : 'FAIL'
    };
  } catch (e) {
    return { path: spec.path, expected_status: spec.status, actual_status: 0,
      result: 'FAIL', error_class: e?.name || 'FetchError' };
  } finally {
    clearTimeout(timer);
  }
}

const routes = [];
for (const check of checks) routes.push(await checkRoute(check));
const passed = routes.every(r => r.result === 'PASS');
const proof = {
  schema: 'dreamledger/cloudflare-preview-route-probe/v1',
  status: passed ? 'PASS_PREVIEW_ONLY_ROUTE_PROBES' : 'BLOCKED_PREVIEW_ROUTE_PROBES',
  observed_at_utc: new Date().toISOString(),
  expected_commit_sha: expectedSha || null,
  preview_origin: base,
  routes,
  count: { total: routes.length, passed: routes.filter(r => r.result === 'PASS').length,
    failed: routes.filter(r => r.result !== 'PASS').length },
  scope: 'This is preview route proof only. The 503 checks prove stateful/payment routes remain explicitly blocked; they are not migration acceptance.',
  production_ready: false,
  dns_changed: false,
  production_mutation: false,
  verified_revenue_nzd: 0
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
if (!passed) process.exitCode = 1;
