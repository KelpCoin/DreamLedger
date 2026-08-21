'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const url = process.env.DREAMIEZ_FUSION_URL || 'https://dreamledger.org/dreamiez-dashboard.html';
const nestedUrl = new URL('/dreamiez/dreamiez-dashboard.html', url).toString();
const outDir = path.resolve(process.env.PROOF_DATA_DIR || path.join(__dirname, '..', 'data', 'proofs'));
const stamp = new Date().toISOString();

function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
async function fetchPage(target) {
  const r = await fetch(target, { redirect: 'follow' });
  return { status: r.status, final_url: r.url, body: await r.text() };
}
async function main() {
  const root = await fetchPage(url);
  const nested = await fetchPage(nestedUrl);
  const rootMarkers = ['Build 4 / Unified Fusion', 'api/dreamiez/me', 'api/dreamiez/cosmetics', 'api/products', 'api/offer-checkout/create', 'scroll-snap', 'BUILD4_FUSION=UNVERIFIED'];
  const nestedMarkers = ['Build 4 / Unified Fusion', 'api/dreamiez/me', 'api/dreamiez/cosmetics', 'api/products', 'api/offer-checkout/create', 'scroll-snap'];
  const markers = {
    root: Object.fromEntries(rootMarkers.map(x => [x, root.body.includes(x)])),
    nested: Object.fromEntries(nestedMarkers.map(x => [x, nested.body.includes(x)]))
  };
  const pass = root.status === 200 && nested.status === 200 && rootMarkers.every(x => markers.root[x]) && nestedMarkers.every(x => markers.nested[x]);
  const proof = {
    schema_version: 'BEC-DREAMIEZ-FUSION-1.1',
    status: pass ? 'PASS_HTTP_STATIC_MARKERS' : 'FAIL',
    url,
    nested_url: nestedUrl,
    checked_at_utc: stamp,
    root: { http_status: root.status, final_url: root.final_url, bytes: Buffer.byteLength(root.body, 'utf8'), sha256: sha256(root.body) },
    nested: { http_status: nested.status, final_url: nested.final_url, bytes: Buffer.byteLength(nested.body, 'utf8'), sha256: sha256(nested.body) },
    markers,
    note: 'This probe proves both live HTML doorways and their unified-surface wiring markers. It does not claim a completed payment.'
  };
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'DREAMIEZ_BUILD4_FUSION_PROOF.json');
  fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (!pass) process.exit(1);
}
main().catch(err => { console.error(err.stack || err.message); process.exit(1); });
