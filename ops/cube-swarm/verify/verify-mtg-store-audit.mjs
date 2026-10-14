'use strict';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const modulePath = path.join(root, 'BEC-PRIME/lib/mtgStoreAudit.js');
const pagePath = path.join(root, 'public/silos/mtg-store-audit/index.html');
const bundlePath = path.join(root, 'public/silos/mtg-store-audit/mtgStoreAudit.js');
for (const file of [modulePath, pagePath, bundlePath]) {
  assert.ok(fs.existsSync(file), 'required build output missing: ' + path.relative(root, file));
}
const source = fs.readFileSync(modulePath, 'utf8');
const bundle = fs.readFileSync(bundlePath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');
assert.equal(bundle, source, 'browser bundle must be byte-identical to tested module');
assert.match(page, /<meta\s+name=["']robots["']\s+content=["']noindex,nofollow["']/i, 'offer remains noindex pending review');
assert.match(page, /mtgStoreAudit\.js/, 'page must load its local module');
assert.doesNotMatch(page, /buy\.stripe\.com|checkout\.session|sk_live_|whsec_/, 'no checkout URL or credential-like string');
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require(modulePath);
assert.equal(typeof api.auditStore, 'function', 'auditStore export required');
assert.equal(typeof api.safeUrl, 'function', 'safeUrl export required');

const now = '2026-10-14T00:00:00.000Z';
const invalid = api.auditStore({ catalog: { products: [] } }, { generatedAt: now });
assert.equal(invalid.status, 'FINDINGS_REQUIRING_REVIEW');
assert.ok(invalid.findings.some(x => x.id === 'SOURCE-001' && x.severity === 'BLOCKER'));

const sourceUrl = 'https://example.test/catalog.json';
const report = api.auditStore({
  store_url: 'https://example.test/store',
  catalog_source_url: sourceUrl,
  catalog: { products: [
    { id: 'a', name: 'Deck A', sku: 'DUP-1', price: 29, currency: 'NZD', checkout_available: true, checkout_url: 'javascript:alert(1)' },
    { id: 'b', name: 'Deck B', sku: 'DUP-1', price: 19, currency: 'NZD', checkout_available: true, checkout_url: null }
  ] },
  pages: [{ url: 'https://example.test/buy', status_code: 503, cta_checks: [{ label: 'Buy', status: 'BLOCKED' }] }]
}, { generatedAt: now });
assert.ok(report.findings.some(x => x.id === 'CATALOG-2-DUPLICATE-SKU'));
assert.ok(report.findings.some(x => x.id === 'CATALOG-1-CHECKOUT'));
assert.ok(report.findings.some(x => x.id.startsWith('CTA-')));
assert.ok(report.findings.every(x => x.source === null || /^https?:\/\//i.test(x.source)));
assert.equal(Object.prototype.hasOwnProperty.call(report, 'revenue_nzd'), false);
assert.ok(report.unknowns.some(x => /revenue|sales volume|buyer intent/i.test(x)));
assert.equal(api.safeUrl('https://example.test/path'), 'https://example.test/path');
assert.equal(api.safeUrl('javascript:alert(1)'), null);
assert.equal(api.safeUrl('file:///etc/passwd'), null);
console.log('PASS: MTG store audit fixed acceptance verifier');
