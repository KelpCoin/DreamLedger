'use strict';

const ISO_CURRENCY = /^[A-Z]{3}$/;
const URL_PROTOCOLS = new Set(['http:', 'https:']);

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (!URL_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) return null;
    return parsed.href;
  } catch (_) { return null; }
}

function finding(id, severity, title, detail, source, evidence) {
  return { id, severity, title, detail, source: source || null, evidence: evidence === undefined ? null : evidence };
}

function auditStore(input, options) {
  options = options || {};
  const now = options.generatedAt || new Date().toISOString();
  const findings = [];
  const unknowns = [
    'Traffic, conversion rate, buyer intent, sales volume, profitability and demand were not measured by this audit.',
    'Only supplied snapshots and checks were evaluated. The tool did not crawl or submit requests to external sites.'
  ];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      schema: 'dreamledger/store-audit-report/v1', generated_at_utc: now, status: 'INPUT_INVALID', target_url: null,
      findings: [finding('INPUT-001', 'BLOCKER', 'Input must be a JSON object', 'Upload a snapshot object containing store_url and any observed pages/catalog data.', null)],
      unknowns: unknowns
    };
  }

  const targetUrl = safeUrl(input.store_url);
  if (!targetUrl) {
    findings.push(finding('SOURCE-001', 'BLOCKER', 'A valid store URL is missing', 'Provide an http(s) URL as the identity of the store being reviewed.', null));
  }

  const pages = Array.isArray(input.pages) ? input.pages : [];
  const catalog = input.catalog && typeof input.catalog === 'object' ? input.catalog : {};
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const catalogSource = safeUrl(input.catalog_source_url) || targetUrl;
  const seenSku = new Map();
  const seenIds = new Map();

  if (!products.length) {
    findings.push(finding('CATALOG-001', 'INFO', 'No product records were supplied',
      'Catalogue consistency could not be evaluated. Supply catalog.products from an export or snapshot.',
      catalogSource, { product_records_observed: 0 }));
  }

  products.forEach(function(product, index) {
    if (!product || typeof product !== 'object' || Array.isArray(product)) {
      findings.push(finding('CATALOG-' + (index + 1) + '-INVALID', 'HIGH', 'A product record is not an object',
        'This record cannot be reliably compared with other catalogue entries.', catalogSource, { index: index }));
      return;
    }

    const ref = catalogSource ? catalogSource + '#products[' + index + ']' : null;
    const name = String(product.name || product.title || '').trim();
    const sku = String(product.sku || '').trim();
    const id = String(product.id || product.product_id || '').trim();
    const price = product.price;
    const currency = String(product.currency || '').trim().toUpperCase();

    if (!name) findings.push(finding('CATALOG-' + (index + 1) + '-NAME', 'MEDIUM', 'Product name is missing',
      'This product cannot be identified clearly from the supplied catalogue record.', ref, { index: index, id: id || null, sku: sku || null }));
    if (!sku) findings.push(finding('CATALOG-' + (index + 1) + '-SKU', 'MEDIUM', 'Product SKU is missing',
      'A stable SKU helps reconcile catalogue, checkout and fulfilment records.', ref, { index: index, id: id || null }));
    else if (seenSku.has(sku)) findings.push(finding('CATALOG-' + (index + 1) + '-DUPLICATE-SKU', 'HIGH', 'Duplicate SKU detected',
      'The same SKU is used by catalogue records ' + seenSku.get(sku) + ' and ' + index + '.', ref,
      { sku: sku, first_index: seenSku.get(sku), duplicate_index: index }));
    else seenSku.set(sku, index);

    if (id) {
      if (seenIds.has(id)) findings.push(finding('CATALOG-' + (index + 1) + '-DUPLICATE-ID', 'HIGH', 'Duplicate product ID detected',
        'The same product ID is used by catalogue records ' + seenIds.get(id) + ' and ' + index + '.', ref,
        { id: id, first_index: seenIds.get(id), duplicate_index: index }));
      else seenIds.set(id, index);
    }

    if (price === null || price === undefined || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) {
      findings.push(finding('CATALOG-' + (index + 1) + '-PRICE', 'HIGH', 'Price is missing or invalid',
        'The supplied record has no non-negative numeric price.', ref, { index: index, supplied_price: price === undefined ? null : price }));
    }
    if (!ISO_CURRENCY.test(currency)) {
      findings.push(finding('CATALOG-' + (index + 1) + '-CURRENCY', 'MEDIUM', 'Currency code is missing or invalid',
        'A three-letter currency code is needed to interpret the supplied price.', ref, { index: index, supplied_currency: product.currency === undefined ? null : product.currency }));
    }

    const enabled = product.checkout_available === true || String(product.status || '').toLowerCase() === 'active';
    const checkoutUrl = safeUrl(product.checkout_url || product.checkout_link || product.payment_link_url);
    if (enabled && !checkoutUrl) {
      findings.push(finding('CATALOG-' + (index + 1) + '-CHECKOUT', 'HIGH', 'Checkout is marked available without a valid URL',
        'The record declares checkout availability but provides no valid http(s) checkout URL.', ref,
        { index: index, checkout_available: product.checkout_available === undefined ? null : product.checkout_available, status: product.status || null }));
    }
    if (checkoutUrl && product.checkout_available === false) {
      findings.push(finding('CATALOG-' + (index + 1) + '-CHECKOUT-CONFLICT', 'LOW', 'Checkout URL is present while checkout is disabled',
        'This may be intentional. Confirm that the page clearly communicates the offer status.', ref,
        { index: index, checkout_available: false, checkout_url_present: true }));
    }
  });

  pages.forEach(function(page, index) {
    if (!page || typeof page !== 'object' || Array.isArray(page)) return;
    const source = safeUrl(page.url);
    const code = Number(page.status_code);
    if (!source) {
      findings.push(finding('PAGE-' + (index + 1) + '-SOURCE', 'BLOCKER', 'Page observation has no valid source URL',
        'A page finding cannot be independently retraced without its URL.', null, { index: index }));
      return;
    }
    if (Number.isFinite(code) && (code < 200 || code >= 400)) {
      findings.push(finding('PAGE-' + (index + 1) + '-STATUS', code >= 500 ? 'HIGH' : 'MEDIUM', 'Observed page returned an unsuccessful status',
        'The supplied observation records HTTP ' + code + '. This tool did not make the request itself.', source,
        { status_code: code, observed_at_utc: page.observed_at_utc || null }));
    }
    (Array.isArray(page.cta_checks) ? page.cta_checks : []).forEach(function(check, checkIndex) {
      if (!check || typeof check !== 'object') return;
      const status = String(check.status || '').toUpperCase();
      if (['FAIL', 'BLOCKED', 'UNREACHABLE'].indexOf(status) < 0) return;
      findings.push(finding('CTA-' + (index + 1) + '-' + (checkIndex + 1), 'HIGH', 'A supplied call-to-action check failed',
        String(check.detail || check.label || 'The supplied observation marks this call-to-action as failed.').slice(0, 500),
        source, { label: String(check.label || 'unnamed CTA'), status: status, observed_at_utc: page.observed_at_utc || null }));
    });
  });

  const rank = { BLOCKER: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
  findings.sort(function(a, b) { return (rank[b.severity] || 0) - (rank[a.severity] || 0) || a.id.localeCompare(b.id); });
  return {
    schema: 'dreamledger/store-audit-report/v1',
    generated_at_utc: now,
    status: findings.some(function(x) { return x.severity === 'BLOCKER' || x.severity === 'HIGH'; }) ? 'FINDINGS_REQUIRING_REVIEW' : 'REVIEW_COMPLETE',
    target_url: targetUrl,
    input_observed_at_utc: input.observed_at_utc || null,
    source_count: pages.length + (products.length ? 1 : 0),
    catalogue_products_observed: products.length,
    finding_count: findings.length,
    findings: findings,
    unknowns: unknowns,
    limitations: [
      'Findings apply only to the supplied snapshot and may be stale.',
      'No remote crawl, checkout attempt, account access or production mutation was performed.',
      'Commercial outcome and revenue are outside this report scope.'
    ]
  };
}

const api = { auditStore: auditStore, safeUrl: safeUrl };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.DreamLedgerStoreAudit = api;
