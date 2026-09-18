#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
const EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.ps1', '.yml', '.yaml', '.sh']);
const REQUIRED = ['product_sku', 'product_id', 'offer_id', 'silo', 'source'];
const CENTRAL_PRELOAD = path.join(ROOT, 'BEC-PRIME', 'lib', 'commercePaymentContractPreload.js');
const PRODUCER_MARKERS = [
  /checkout\/sessions/i,
  /stripe\.checkout\.sessions\.create/i,
  /stripeCheckout\s*\(/i,
  /stripeRequest\s*\(/i,
  /fetch\s*\(\s*[`'\"]https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/i,
  /curl[^\n]*api\.stripe\.com\/v1\/checkout\/sessions/i,
  /urllib[^\n]*api\.stripe\.com\/v1\/checkout\/sessions/i
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

function hasAnyProducer(text) {
  return PRODUCER_MARKERS.some((r) => r.test(text));
}

function isReadOnlyStripeUse(text) {
  const lower = text.toLowerCase();
  if (!lower.includes('checkout/sessions')) return true;
  return !/(method\s*[:=]\s*['\"]post['\"]|stripeCheckout\s*\(|stripeRequest\s*\(|sessions\s*\.create|curl[^\n]*-x\s+post|post\s+https?:\/\/api\.stripe\.com\/v1\/checkout\/sessions)/i.test(text);
}

function producerWindows(text) {
  const lines = text.split(/\r?\n/);
  const windows = [];
  for (let i = 0; i < lines.length; i++) {
    if (!PRODUCER_MARKERS.some((r) => r.test(lines[i]))) continue;
    const start = Math.max(0, i - 35);
    const end = Math.min(lines.length, i + 65);
    windows.push({ start: start + 1, end, text: lines.slice(start, end).join('\n') });
  }
  return windows;
}

function metadataPresent(windowText, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normalized = windowText.replace(/\s+/g, ' ');
  if (windowText.includes('payment_intent_data[metadata][' + key + ']')) return true;
  const direct = new RegExp('payment_intent_data[^\\n]{0,180}metadata[^\\n]{0,120}(?:[\\[.]' + escaped + '|[\"\\\']' + escaped + '[\"\\\'])', 'i');
  const urlEncoded = new RegExp('payment_intent_data\\[metadata\\]\\[' + escaped + '\\]', 'i');
  const objectForm = new RegExp('payment_intent_data[^\\n]{0,500}metadata[^\\n]{0,500}[\"\\\']?' + escaped + '[\"\\\']?', 'i');
  return direct.test(windowText) || urlEncoded.test(windowText) || objectForm.test(windowText) || urlEncoded.test(normalized);
}

const files = walk(ROOT);
const producers = [];
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'ops/commerce/reconcile-stripe-airtable.mjs') continue;
  const text = fs.readFileSync(file, 'utf8');
  if (!hasAnyProducer(text) || isReadOnlyStripeUse(text)) continue;
  for (const win of producerWindows(text)) {
    const directCanonical = REQUIRED.every((k) => win.text.includes('payment_intent_data[metadata][' + k + ']'));
    const missing = directCanonical ? [] : REQUIRED.filter((k) => !metadataPresent(win.text, k));
    producers.push({ file: rel, lines: [win.start, win.end], missing });
  }
}

const dedup = new Map();
for (const p of producers) {
  const key = p.file + ':' + p.lines.join('-');
  dedup.set(key, p);
}
const rows = [...dedup.values()];
const preloadActive = fs.existsSync(CENTRAL_PRELOAD) &&
  /payment_intent_data\[metadata\]\[product_sku\]/.test(fs.readFileSync(CENTRAL_PRELOAD, 'utf8')) &&
  /api\.stripe\.com\/v1\/checkout\/sessions/.test(fs.readFileSync(CENTRAL_PRELOAD, 'utf8'));
for (const row of rows) {
  if (preloadActive && row.file.startsWith('BEC-PRIME/') && row.missing.length) {
    row.coverage = 'central_preload';
    row.missing = [];
  } else if (!row.coverage) {
    row.coverage = 'direct';
  }
}
const failures = rows.filter((r) => r.missing.length);
const proofDir = path.join(ROOT, 'data', 'proofs');
fs.mkdirSync(proofDir, { recursive: true });
const proof = {
  schema: 'DREAMLEDGER.STRIPE_CHECKOUT_CONTRACT.v1',
  generated_utc: new Date().toISOString(),
  required_payment_intent_metadata: REQUIRED,
  producer_windows: rows,
  producer_window_count: rows.length,
  failing_window_count: failures.length,
  central_preload: preloadActive,
  status: failures.length ? 'FAIL' : 'PASS'
};
const proofPath = path.join(proofDir, 'stripe-checkout-contract-latest.json');
fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');

for (const row of rows) {
  const label = row.file + ':' + row.lines[0] + '-' + row.lines[1];
  console.log((row.missing.length ? 'FAIL ' : 'PASS ') + label + (row.missing.length ? ' missing=' + row.missing.join(',') : ''));
}
console.log('PROOF=' + proofPath);
console.log('PRODUCERS=' + rows.length);
console.log('FAILURES=' + failures.length);

process.exitCode = failures.length ? 1 : 0;
