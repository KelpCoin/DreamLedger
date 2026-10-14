'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { auditStore, safeUrl } = require('./mtgStoreAudit');

const base = {
  store_url: 'https://example.test/store',
  catalog_source_url: 'https://example.test/catalog.json',
  observed_at_utc: '2026-10-14T00:00:00.000Z',
  catalog: { products: [] },
  pages: []
};

test('rejects missing or invalid store identity with an explicit blocker', () => {
  const report = auditStore({ catalog: { products: [] } }, { generatedAt: '2026-10-14T00:00:00.000Z' });
  assert.equal(report.status, 'FINDINGS_REQUIRING_REVIEW');
  assert.ok(report.findings.some(x => x.id === 'SOURCE-001' && x.severity === 'BLOCKER'));
});

test('flags duplicate SKU and invalid checkout URL with source attribution', () => {
  const report = auditStore({
    ...base,
    catalog: { products: [
      { id: 'p1', name: 'Deck A', sku: 'DECK-1', price: 29, currency: 'NZD', status: 'active', checkout_url: 'javascript:alert(1)' },
      { id: 'p2', name: 'Deck B', sku: 'DECK-1', price: 39, currency: 'NZD', checkout_available: true, checkout_url: null }
    ] }
  });
  assert.ok(report.findings.some(x => x.id === 'CATALOG-2-DUPLICATE-SKU' && x.source === base.catalog_source_url + '#products[1]'));
  assert.ok(report.findings.some(x => x.id === 'CATALOG-1-CHECKOUT' && x.source === base.catalog_source_url + '#products[0]'));
  assert.ok(report.findings.every(x => x.source === null || x.source.startsWith('https://')));
});

test('reports failed CTA only when an observed page URL is supplied', () => {
  const report = auditStore({
    ...base,
    pages: [{ url: 'https://example.test/buy', status_code: 200, observed_at_utc: base.observed_at_utc,
      cta_checks: [{ label: 'Buy now', status: 'BLOCKED', detail: 'Checkout destination returned 503' }] }]
  });
  const cta = report.findings.find(x => x.id.startsWith('CTA-'));
  assert.ok(cta);
  assert.equal(cta.source, 'https://example.test/buy');
  assert.equal(cta.evidence.status, 'BLOCKED');
});

test('does not infer traffic, sales, conversion or revenue from catalog data', () => {
  const report = auditStore({ ...base, catalog: { products: [{ name: 'Deck', sku: 'D-1', price: 29, currency: 'NZD' }] } });
  assert.equal(Object.prototype.hasOwnProperty.call(report, 'revenue_nzd'), false);
  assert.ok(report.unknowns.some(x => x.indexOf('Traffic, conversion rate, buyer intent, sales volume, profitability and demand were not measured') >= 0));
});

test('never labels malformed input as a successful audit', () => {
  const report = auditStore(null);
  assert.equal(report.status, 'INPUT_INVALID');
  assert.ok(report.findings.length > 0);
});

test('accepts only http(s) source URLs', () => {
  assert.equal(safeUrl('https://example.test/a'), 'https://example.test/a');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('file:///etc/passwd'), null);
});
