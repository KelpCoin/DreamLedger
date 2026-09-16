#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', 'legacy']);
const EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.ps1', '.yml', '.yaml', '.sh']);
const REQUIRED = ['product_sku', 'product_id', 'offer_id', 'silo', 'source'];
const PRODUCER_MARKERS = [
  /stripe\.checkout\.sessions\.create/i,
  /fetch\s*\(\s*[`'\"]https:\/\/api\.stripe\.com\/v1\/checkout\/sessions[^\n]{0,260}method\s*:\s*['\"]POST['\"]/is,
  /fetch\s*\(\s*STRIPE_API\s*,\s*\{[^}]{0,500}method\s*:\s*['\"]POST['\"]/is,
  /stripePost\s*\(\s*['\"]checkout\/sessions['\"]/i
];
function walk(dir, out = []) { for (const name of fs.readdirSync(dir)) { if (SKIP.has(name)) continue; const full = path.join(dir, name); const st = fs.statSync(full); if (st.isDirectory()) walk(full, out); else if (EXT.has(path.extname(name).toLowerCase())) out.push(full); } return out; }
function hasAnyProducer(text) { return PRODUCER_MARKERS.some((r) => r.test(text)); }
function producerWindows(text) { const lines = text.split(/\r?\n/); const windows = []; for (let i = 0; i < lines.length; i++) { if (!PRODUCER_MARKERS.some((r) => r.test(lines[i]))) continue; const start = Math.max(0, i - 35); const end = Math.min(lines.length, i + 120); windows.push({ start: start + 1, end, text: lines.slice(start, end).join('\n') }); } return windows; }
function metadataPresent(windowText, key) { const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const paymentIntent = new RegExp('payment_intent_data[^\\n]{0,220}metadata[^\\n]{0,220}(?:\\[' + escaped + '\\]|["\\\']' + escaped + '["\\\'])', 'i'); const subscription = new RegExp('subscription_data[^\\n]{0,220}metadata[^\\n]{0,220}(?:\\[' + escaped + '\\]|["\\\']' + escaped + '["\\\'])', 'i'); return paymentIntent.test(windowText) || subscription.test(windowText); }
const files = walk(ROOT); const producers = [];
for (const file of files) { const text = fs.readFileSync(file, 'utf8'); if (!hasAnyProducer(text)) continue; const rel = path.relative(ROOT, file).replace(/\\/g, '/'); for (const win of producerWindows(text)) { const missing = REQUIRED.filter((k) => !metadataPresent(win.text, k)); producers.push({ file: rel, lines: [win.start, win.end], missing }); } }
const dedup = new Map(); for (const p of producers) dedup.set(p.file + ':' + p.lines.join('-'), p); const rows = [...dedup.values()]; const failures = rows.filter((r) => r.missing.length);
const proofDir = path.join(ROOT, 'data', 'proofs'); fs.mkdirSync(proofDir, { recursive: true }); const proof = { schema: 'DREAMLEDGER.STRIPE_CHECKOUT_CONTRACT.v6', generated_utc: new Date().toISOString(), required_payment_intent_metadata: REQUIRED, producer_windows: rows, producer_window_count: rows.length, failing_window_count: failures.length, status: failures.length ? 'FAIL' : 'PASS' };
const proofPath = path.join(proofDir, 'stripe-checkout-contract-latest.json'); fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
for (const row of rows) { const label = row.file + ':' + row.lines[0] + '-' + row.lines[1]; console.log((row.missing.length ? 'FAIL ' : 'PASS ') + label + (row.missing.length ? ' missing=' + row.missing.join(',') : '')); }
console.log('PROOF=' + proofPath); console.log('PRODUCERS=' + rows.length); console.log('FAILURES=' + failures.length); process.exitCode = failures.length ? 1 : 0;
