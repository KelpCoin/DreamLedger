#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'BEC-PRIME', 'catalog', 'public-agent-products.source.json');
const OUTPUT = path.join(ROOT, 'public', 'agent-products.json');
const PROOF = path.join(ROOT, 'BEC-PRIME', 'PROOF-PUBLIC-AGENT-PRODUCTS-COMPILATION.json');

const REQUIRED = [
  'item_id', 'title', 'description', 'url', 'brand',
  'seller_name', 'seller_url', 'price', 'availability',
  'sku', 'category', 'required_input', 'one_time_purchase',
  'subscription', 'enable_search', 'enable_checkout'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateCatalog(items) {
  assert(Array.isArray(items), 'Public agent-product source must be a JSON array.');
  const ids = new Set();
  const skus = new Set();

  for (const [index, item] of items.entries()) {
    assert(item && typeof item === 'object' && !Array.isArray(item), 'Product at index ' + index + ' must be an object.');
    for (const field of REQUIRED) {
      assert(Object.prototype.hasOwnProperty.call(item, field), 'Product at index ' + index + ' is missing ' + field + '.');
    }
    for (const field of ['item_id', 'title', 'description', 'url', 'brand', 'seller_name', 'seller_url', 'price', 'availability', 'sku', 'category']) {
      assert(typeof item[field] === 'string' && item[field].trim().length > 0, item.item_id + ': ' + field + ' must be a non-empty string.');
    }
    assert(/^https:\/\//i.test(item.url), item.item_id + ': URL must use HTTPS.');
    assert(/^https:\/\//i.test(item.seller_url), item.item_id + ': seller URL must use HTTPS.');
    assert(typeof item.one_time_purchase === 'boolean', item.item_id + ': one_time_purchase must be boolean.');
    assert(typeof item.subscription === 'boolean', item.item_id + ': subscription must be boolean.');
    assert(typeof item.enable_search === 'boolean', item.item_id + ': enable_search must be boolean.');
    assert(typeof item.enable_checkout === 'boolean', item.item_id + ': enable_checkout must be boolean.');
    assert(!ids.has(item.item_id), 'Duplicate item_id: ' + item.item_id);
    assert(!skus.has(item.sku), 'Duplicate SKU: ' + item.sku);
    ids.add(item.item_id);
    skus.add(item.sku);
  }

  const truth = items.filter(x => x.item_id === 'TRUTH-ORACLE-ACCESS-001');
  assert(truth.length === 1, 'Exactly one canonical TRUTH-ORACLE-ACCESS-001 is required.');
  assert(truth[0].price === '9 NZD', 'Truth Oracle Access must retain the explicit NZ$9 display price.');
  assert(truth[0].url === 'https://dreamledger.org/truth-oracle.html', 'Truth Oracle Access must point to the canonical Truth Oracle surface.');
  assert(truth[0].availability === 'review_required', 'Truth Oracle Access must remain review_required.');
  assert(truth[0].enable_checkout === false, 'Truth Oracle Access checkout must remain disabled.');
  assert(!ids.has('AGENT-PROOF-AUDIT-49'), 'Retired standalone audit listing must not be reintroduced.');
  assert(!items.some(x => x.item_id === 'AGENT-PROOF-AUDIT-49' || x.sku === 'AGENT-PROOF-AUDIT-49'), 'Retired standalone audit SKU must stay absent.');

  return items;
}

function compile({ write = true } = {}) {
  const sourceBytes = fs.readFileSync(SOURCE);
  const items = JSON.parse(sourceBytes.toString('utf8').replace(/^\uFEFF/, ''));
  validateCatalog(items);

  const outputBytes = Buffer.from(JSON.stringify(items, null, 2) + '\n', 'utf8');
  const proof = {
    schema: 'dreamledger/public-agent-products-compilation-proof/v1',
    status: 'PASS',
    generated_at_utc: new Date().toISOString(),
    source: path.relative(ROOT, SOURCE).replace(/\\/g, '/'),
    output: path.relative(ROOT, OUTPUT).replace(/\\/g, '/'),
    source_sha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'),
    output_sha256: crypto.createHash('sha256').update(outputBytes).digest('hex'),
    product_count: items.length,
    truth_oracle_access: {
      item_id: 'TRUTH-ORACLE-ACCESS-001',
      availability: 'review_required',
      checkout_enabled: false
    },
    retired_standalone_audit_absent: true,
    economic_truth_effect: 'NONE',
    external_action: 'NONE'
  };

  if (write) {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, outputBytes);
    fs.mkdirSync(path.dirname(PROOF), { recursive: true });
    fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n');
  }

  return { items, output: outputBytes.toString('utf8'), proof };
}

if (require.main === module) {
  try {
    const result = compile();
    process.stdout.write(JSON.stringify(result.proof, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('PUBLIC_AGENT_PRODUCTS_COMPILATION=FAIL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { compile, validateCatalog };
