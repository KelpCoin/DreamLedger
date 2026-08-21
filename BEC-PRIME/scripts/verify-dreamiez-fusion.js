'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const url = process.env.DREAMIEZ_FUSION_URL || 'https://dreamledger.org/dreamiez/dreamiez-dashboard.html';
const outDir = path.resolve(process.env.PROOF_DATA_DIR || path.join(__dirname, '..', 'data', 'proofs'));
const stamp = new Date().toISOString();

function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
async function main() {
  const r = await fetch(url, { redirect: 'follow' });
  const body = await r.text();
  const required = [
    'Build 4 / Unified Fusion',
    'api/dreamiez/me',
    'api/dreamiez/cosmetics',
    'api/products',
    'api/offer-checkout/create',
    'scroll-snap',
    'BUILD4_FUSION=UNVERIFIED'
  ];
  const markers = Object.fromEntries(required.map(x => [x, body.includes(x)]));
  const pass = r.status === 200 && required.every(x => markers[x]);
  const proof = {
    schema_version: 'BEC-DREAMIEZ-FUSION-1.0',
    status: pass ? 'PASS_HTTP_STATIC_MARKERS' : 'FAIL',
    url,
    checked_at_utc: stamp,
    http_status: r.status,
    final_url: r.url,
    bytes: Buffer.byteLength(body, 'utf8'),
    sha256: sha256(body),
    markers,
    note: 'This probe proves the deployed unified HTML surface and its wiring markers. It does not claim a completed payment.'
  };
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'DREAMIEZ_BUILD4_FUSION_PROOF.json');
  fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (!pass) process.exit(1);
}
main().catch(err => { console.error(err.stack || err.message); process.exit(1); });
