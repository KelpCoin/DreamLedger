#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
const EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.ps1', '.yml', '.yaml', '.sh']);
const REQUIRED = ['product_sku', 'product_id', 'offer_id', 'silo', 'source'];

// Detect actual Stripe Checkout session creation sites, not calls to local helper
// functions such as stripeCheckout(). The helper definition owns the Stripe POST;
// its nearby checkout parameter object is inspected as part of the same producer.
const PRODUCER_MARKERS = [
  /stripe\.checkout\.sessions\.create/i,
  /sessions\.create\s*\(/i,
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
  return !/(method\s*[:=]\s*['\"]post['\"]|sessions\.create\s*\(|curl[^\n]*-x\s+post|post\s+https?:\/\/api\.stripe\.com\/v1\/checkout\/sessions)/i.test(text);
}

function producerWindows(text) {
  const lines = text.split(/\r?\n/);
  const windows = [];
  for (let i = 0; i < lines.length; i++) {
    if (!PRODUCER_MARKERS.some((r) => r.test(lines[i]))) continue;
    const start = Math.max(0, i - 35);
    // Some local Stripe helpers build params at the call site more than 65 lines
    // after the POST helper. Keep one bounded producer window large enough to
    // capture that contract without scanning the entire file.
    const end = Math.min(lines.length, i + 150);
    windows.push({ start: start + 1, end, text: lines.slice(start, end).join('\n') });
  }
  return windows;
}

function metadataPresent(windowText, key) {
  const exact = `payment_intent_data[metadata][${key}]`;
  if (windowText.includes(exact)) return true;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const object = new RegExp('payment_intent_data[\\s\\S]{0,3000}metadata[\\s\\S]{0,1500}[\\[\\."\\\']' + escaped + '[\\]"\\\']', 'i');
  return object.test(windowText);
}

const files = walk(ROOT);
const producers = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (!hasAnyProducer(text) || isReadOnlyStripeUse(text)) continue;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const win of producerWindows(text)) {
    const missing = REQUIRED.filter((k) => !metadataPresent(win.text, k));
    producers.push({ file: rel, lines: [win.start, win.end], missing });
  }
}

const dedup = new Map();
for (const p of producers) {
  const key = p.file + ':' + p.lines.join('-');
  dedup.set(key, p);
}
const rows = [...dedup.values()];
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
