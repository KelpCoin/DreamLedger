#!/usr/bin/env node
/**
 * Probes a deployed Cloudflare Pages migration preview only.
 * Requires exact deployment SHA, published MTG detail/claim checks, and a real 404.
 * Never treats the static preview as production readiness.
 */
import fs from 'node:fs';
import path from 'node:path';

const baseRaw = String(process.env.CLOUDFLARE_PREVIEW_URL || '').trim();
const expectedSha = String(process.env.GITHUB_SHA || '').trim();
const output = process.env.MIGRATION_PROOF_PATH || 'proof/migration/cloudflare-preview-route-probe.json';
const started = new Date().toISOString();
let base = null;

function persist(proof) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

try {
  const u = new URL(baseRaw);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.pages.dev') ||
      u.username || u.password || u.search || u.hash) {
    throw new Error('Preview URL must be an origin on HTTPS *.pages.dev without credentials, query or fragment');
  }
  base = u.origin;
} catch (e) {
  persist({
    schema: 'dreamledger/cloudflare-preview-route-probe/v2',
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
  });
  process.exit(2);
}

async function probe(spec) {
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
    const contentTypeOk = spec.type === 'json'
      ? /application\/json/i.test(contentType)
      : /text\/html/i.test(contentType);
    const markerOk = !spec.marker || (spec.marker instanceof RegExp
      ? spec.marker.test(bodyText)
      : bodyText.toLowerCase().includes(String(spec.marker).toLowerCase()));
    const contractOk = !spec.validate || (jsonValid && spec.validate(body));
    const statusOk = response.status === spec.status;
    const ok = statusOk && contentTypeOk && markerOk && contractOk;
    return {
      summary: {
        path: spec.path,
        expected_status: spec.status,
        actual_status: response.status,
        content_type_ok: contentTypeOk,
        json_valid: spec.type !== 'json' || jsonValid,
        body_contract_ok: contractOk,
        marker_ok: markerOk,
        result: ok ? 'PASS' : 'FAIL'
      },
      bodyText,
      body,
      status: response.status,
      contentType
    };
  } catch (e) {
    return {
      summary: { path: spec.path, expected_status: spec.status, actual_status: 0,
        result: 'FAIL', error_class: e?.name || 'FetchError' },
      bodyText: '',
      body: null,
      status: 0,
      contentType: ''
    };
  } finally {
    clearTimeout(timer);
  }
}

const routeChecks = [
  { path: '/', status: 200, type: 'html', marker: /DreamLedger|Dream Ledger/i },
  { path: '/mtg/', status: 200, type: 'html', marker: /Magic|MTG|Commander/i },
  { path: '/truth-oracle.html', status: 200, type: 'html' },
  { path: '/404.html', status: 200, type: 'html', marker: 'Page not found' },
  { path: '/silos/mtg/silo.json', status: 200, type: 'json' },
  { path: '/data/mtg-catalog.json', status: 200, type: 'json', validate: b =>
    b.schema === 'dreamledger/mtg-catalogue/v1' && b.silo === 'mtg' &&
    b.currency === 'NZD' && Array.isArray(b.products) },
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

const routes = [];
const initial = new Map();
for (const spec of routeChecks) {
  const result = await probe(spec);
  routes.push(result.summary);
  initial.set(spec.path, result);
}

const catalogResult = initial.get('/data/mtg-catalog.json');
const catalog = catalogResult?.body;
if (!catalogResult || catalogResult.status !== 200 || !catalog || !Array.isArray(catalog.products)) {
  routes.push({
    path: 'MTG published listing contract',
    expected_status: 'valid published-only catalogue',
    actual_status: catalogResult?.status ?? 0,
    result: 'FAIL',
    error_class: 'CATALOGUE_UNREADABLE'
  });
} else {
  const published = catalog.products.filter(p => p && p.status === 'published');
  if (published.length === 0) {
    routes.push({ path: 'MTG published listing contract', expected_status: 'one or more published products',
      actual_status: 0, result: 'FAIL', error_class: 'NO_PUBLISHED_MTG_PRODUCTS' });
  }

  for (const product of published) {
    const id = String(product.id || product.sku || 'unknown-product');
    const detailPath = String(product.detail_url || '');
    const claimUrl = String(product.claim_url || '');
    let claimValid = false;
    try {
      const claim = new URL(claimUrl);
      claimValid = (claim.protocol === 'mailto:' || claim.protocol === 'https:') &&
        !claim.username && !claim.password;
    } catch { claimValid = false; }

    routes.push({
      path: 'MTG claim action:' + id,
      expected_status: 'published product has a safe, explicit claim_url',
      actual_status: claimUrl ? claimUrl.split(':', 1)[0] : 'missing',
      result: product.silo === 'mtg' && claimValid ? 'PASS' : 'FAIL',
      product_id: id,
      sale_mode: product.sale_mode || null,
      checkout_available: product.checkout_available === true
    });

    if (!detailPath.startsWith('/') || detailPath.startsWith('//') || detailPath.includes('..')) {
      routes.push({ path: 'MTG detail route:' + id, expected_status: 'root-relative safe detail_url',
        actual_status: detailPath || 'missing', result: 'FAIL', product_id: id });
      continue;
    }

    const preferredMarker = product.commander && product.commander !== 'See listing' ? product.commander : (product.name || product.id || '');
    const primaryMarker = String(preferredMarker).split(' ' + String.fromCharCode(0x2014) + ' ')[0].trim();
    const detail = await probe({
      path: detailPath,
      status: 200,
      type: 'html',
      marker: primaryMarker || null
    });

    routes.push({
      ...detail.summary,
      path: 'MTG detail:' + detailPath,
      product_id: id,
      product_marker_ok: detail.summary.marker_ok,
      claim_action_present: /href\s*=\s*["'][^"']*mailto:/i.test(detail.bodyText) ||
        /href\s*=\s*["'][^"']*claim/i.test(detail.bodyText)
    });

    if (!(/href\s*=\s*["'][^"']*mailto:/i.test(detail.bodyText) ||
          /href\s*=\s*["'][^"']*claim/i.test(detail.bodyText))) {
      routes.push({ path: 'MTG detail claim control:' + id, expected_status: 'claim action in detail page',
        actual_status: detail.status, result: 'FAIL', product_id: id });
    }
  }
}

const missingPath = '/__cloudflare_preview_404_probe_' +
  (expectedSha ? expectedSha.slice(0, 12) : 'missing-sha') + '.html';
const notFound = await probe({
  path: missingPath,
  status: 404,
  type: 'html',
  marker: 'Page not found'
});
routes.push({
  ...notFound.summary,
  path: 'genuine_404:' + missingPath,
  purpose: 'An unknown route must return 404, not the root SPA/homepage.'
});

const passed = routes.length > 0 && routes.every(r => r.result === 'PASS');
const proof = {
  schema: 'dreamledger/cloudflare-preview-route-probe/v2',
  status: passed ? 'PASS_PREVIEW_ONLY_ROUTE_PROBES' : 'BLOCKED_PREVIEW_ROUTE_PROBES',
  observed_at_utc: new Date().toISOString(),
  expected_commit_sha: expectedSha || null,
  preview_origin: base,
  routes,
  count: { total: routes.length, passed: routes.filter(r => r.result === 'PASS').length,
    failed: routes.filter(r => r.result !== 'PASS').length },
  scope: 'Preview-route proof only. The 503 checks prove stateful/payment routes remain explicitly blocked; they are not migration acceptance.',
  production_ready: false,
  dns_changed: false,
  production_mutation: false,
  verified_revenue_nzd: 0
};
persist(proof);
if (!passed) process.exitCode = 1;
