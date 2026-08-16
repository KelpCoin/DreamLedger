'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'surface', 'board.v1.template.html');
const OUT = path.join(ROOT, 'compiled', 'website', 'board.html');
const PROOF = path.join(ROOT, 'PROOF-BILLBOARD-COMPILATION.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

if (!fs.existsSync(TEMPLATE)) throw new Error('Billboard template missing');
const html = fs.readFileSync(TEMPLATE, 'utf8');
const forbidden = ['amplissa', 'bbw', 'adult-only', 'stripe_secret_key', 'stripe_webhook_secret', '127.0.0.1', 'BEC-PRIME'];
const lower = html.toLowerCase();
for (const token of forbidden) {
  if (lower.includes(token.toLowerCase())) throw new Error('BILLBOARD_PUBLIC_SURFACE_GATE_FAILED: ' + token);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
const proof = {
  type: 'dreamledger-billboard-compilation-proof',
  status: 'PASS',
  compiler: 'billboard-v1',
  source_hash: sha256(html),
  output: 'compiled/website/board.html',
  slot_count: 10000,
  sku: 'BILLBOARD-SMALL',
  price_nzd: 5,
  payment_link: 'https://buy.stripe.com/6oU3cvea16pL96nbN2dwc1s',
  compiled_at: new Date().toISOString()
};
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
