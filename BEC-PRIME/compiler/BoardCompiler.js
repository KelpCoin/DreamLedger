'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'surface', 'board.v1.template.html');
const OUT = path.join(ROOT, 'compiled', 'website', 'board.html');
const PROOF = path.join(ROOT, 'PROOF-BILLBOARD-COMPILATION.json');

function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }

if (!fs.existsSync(TEMPLATE)) throw new Error('Billboard template missing');
const html = fs.readFileSync(TEMPLATE, 'utf8');
const forbidden = ['amplissa', 'bbw', 'adult-only', 'stripe_secret_key', 'stripe_webhook_secret', '127.0.0.1', 'BEC-PRIME'];
const lower = html.toLowerCase();
for (const token of forbidden) {
  if (lower.includes(token.toLowerCase())) throw new Error('BILLBOARD_PUBLIC_SURFACE_GATE_FAILED: ' + token);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
const sizes = [
  { sku:'BILLBOARD-SMALL', label:'Small', w:100, h:100, price_nzd:29 },
  { sku:'BILLBOARD-MEDIUM', label:'Medium', w:200, h:100, price_nzd:79 },
  { sku:'BILLBOARD-WIDE', label:'Wide', w:500, h:200, price_nzd:149 },
  { sku:'BILLBOARD-LARGE', label:'Large', w:500, h:500, price_nzd:349 },
  { sku:'BILLBOARD-TAKEOVER', label:'Takeover', w:1000, h:1000, price_nzd:999 }
];
const proof = {
  type: 'dreamledger-billboard-compilation-proof',
  status: 'PASS',
  compiler: 'billboard-v2',
  source_hash: sha256(html),
  output: 'compiled/website/board.html',
  public_surface: 'dreamledger.org/billboard',
  slot_count: 10000,
  sizes,
  human_review_required: true,
  payment_flow: 'stripe-checkout-session',
  fulfilment_flow: 'payment -> human review -> publication -> ledger proof',
  compiled_at: new Date().toISOString()
};
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
