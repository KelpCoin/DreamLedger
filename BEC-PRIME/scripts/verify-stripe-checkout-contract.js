#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
const EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.ps1', '.yml', '.yaml', '.sh']);
const REQUIRED = ['product_sku', 'product_id', 'offer_id', 'silo', 'source'];
const PRODUCER_MARKERS = [
  /checkout\/sessions/i,
  /stripe\.checkout\.sessions\.create/i,
  /stripeCheckout\s*\(/i,
  /stripeRequest\s*\(/i,
  /fetch\s*\(\s*[`'\"]https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/i,
  /curl[^\n]*api\.stripe\.com\/v1\/checkout\/sessions/i,
  /urllib[^\n]*api\.stripe\.com\/v1\/checkout\/sessions/i
];
const POST_MARKERS = [
  /method\s*[:=]\s*['\"]POST['\"]/i,
  /sessions\s*\.create/i,
  /stripeCheckout\s*\(/i,
  /stripeRequest\s*\(/i,
  /curl[^\n]*-x\s+post/i,
  /post\s+https?:\/\/api\.stripe\.com\/v1\/checkout\/sessions/i
];
const IDENTITY_MARKERS = [
  /metadata\[(?:product_id|product_sku|offer_id|listing_id|cart_id|ad_id|sku|product)\]/i,
  /metadata\.(?:product_id|product_sku|offer_id|listing_id|cart_id|ad_id|sku|product)/i
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

function hasAnyProducer(text) { return PRODUCER_MARKERS.some(r => r.test(text)); }
function hasCheckoutPost(text) { return POST_MARKERS.some(r => r.test(text)); }
function isReadOnlyStripeUse(text) { return !hasCheckoutPost(text); }

function producerWindows(text) {
  const lines = text.split(/\r?\n/);
  const windows = [];
  for (let i = 0; i < lines.length; i++) {
    if (!PRODUCER_MARKERS.some(r => r.test(lines[i]))) continue;
    const start = Math.max(0, i - 60);
    const end = Math.min(lines.length, i + 100);
    windows.push({ start: start + 1, end, text: lines.slice(start, end).join('\n') });
  }
  return windows;
}

function metadataPresent(windowText, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const direct = new RegExp('payment_intent_data[^\\n]{0,300}metadata[^\\n]{0,180}(?:[\\[.]' + escaped + '|[\\"\\\']' + escaped + '[\\"\\\'])', 'i');
  const urlEncoded = new RegExp('payment_intent_data\\[metadata\\]\\[' + escaped + '\\]', 'i');
  const objectForm = new RegExp('payment_intent_data[^\\n]{0,800}metadata[^\\n]{0,800}[\\"\\\']?' + escaped + '[\\"\\\']?', 'i');
  return direct.test(windowText) || urlEncoded.test(windowText) || objectForm.test(windowText);
}

function adapterInstalled() {
  const adapter = path.join(ROOT, 'BEC-PRIME', 'lib', 'legacyStripeContractPreload.js');
  const pkg = path.join(ROOT, 'BEC-PRIME', 'package.json');
  if (!fs.existsSync(adapter) || !fs.existsSync(pkg)) return false;
  const adapterText = fs.readFileSync(adapter, 'utf8');
  const packageText = fs.readFileSync(pkg, 'utf8');
  return /payment_intent_data\[metadata\]\[product_sku\]/.test(adapterText)
    && /payment_intent_data\[metadata\]\[product_id\]/.test(adapterText)
    && /payment_intent_data\[metadata\]\[offer_id\]/.test(adapterText)
    && /payment_intent_data\[metadata\]\[silo\]/.test(adapterText)
    && /payment_intent_data\[metadata\]\[source\]/.test(adapterText)
    && /legacyStripeContractPreload\.js/.test(packageText);
}

const adapter = adapterInstalled();
const files = walk(ROOT);
const producers = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (!hasAnyProducer(text) || isReadOnlyStripeUse(text)) continue;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const win of producerWindows(text)) {
    let missing = REQUIRED.filter(k => !metadataPresent(win.text, k));
    let covered_by_adapter = false;
    if (missing.length && adapter && IDENTITY_MARKERS.some(r => r.test(win.text))) {
      covered_by_adapter = true;
      missing = [];
    }
    producers.push({ file: rel, lines: [win.start, win.end], missing, covered_by_adapter });
  }
}

const dedup = new Map();
for (const p of producers) {
  const key = p.file + ':' + p.lines.join('-');
  dedup.set(key, p);
}
const rows = [...dedup.values()];
const failures = rows.filter(r => r.missing.length);
const proofDir = path.join(ROOT, 'data', 'proofs');
fs.mkdirSync(proofDir, { recursive: true });
const proof = {
  schema: 'DREAMLEDGER.STRIPE_CHECKOUT_CONTRACT.v2',
  generated_utc: new Date().toISOString(),
  required_payment_intent_metadata: REQUIRED,
  legacy_transport_adapter: adapter ? 'INSTALLED_AND_LOADED' : 'MISSING',
  producer_windows: rows,
  producer_window_count: rows.length,
  adapter_covered_window_count: rows.filter(r => r.covered_by_adapter).length,
  failing_window_count: failures.length,
  status: failures.length ? 'FAIL' : 'PASS'
};
const proofPath = path.join(proofDir, 'stripe-checkout-contract-latest.json');
fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');

for (const row of rows) {
  const label = row.file + ':' + row.lines[0] + '-' + row.lines[1];
  console.log((row.missing.length ? 'FAIL ' : 'PASS ') + label + (row.covered_by_adapter ? ' adapter=legacy_transport' : '') + (row.missing.length ? ' missing=' + row.missing.join(',') : ''));
}
console.log('PROOF=' + proofPath);
console.log('PRODUCERS=' + rows.length);
console.log('ADAPTER_COVERED=' + rows.filter(r => r.covered_by_adapter).length);
console.log('FAILURES=' + failures.length);

process.exitCode = failures.length ? 1 : 0;
