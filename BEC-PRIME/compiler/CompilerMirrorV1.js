'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'mirror');
const PROOF = path.join(ROOT, 'data', 'proofs', 'COMPILER-MIRROR-LATEST.json');
const ALLOW = [
  ['compiled/website/index.html', 'public/index.html'],
  ['compiled/website/cinema.html', 'public/cinema.html'],
  ['compiled/website/digital-products.html', 'public/digital-products.html'],
  ['compiled/website/security.html', 'public/security.html'],
  ['compiled/website/login.html', 'public/login.html'],
  ['compiled/website/register.html', 'public/register.html'],
  ['compiled/website/account.html', 'public/account.html'],
  ['compiled/website/avatar.html', 'public/avatar.html'],
  ['compiled/website/assets.html', 'public/assets.html'],
  ['catalog/offers/offers.json', 'control/offers.json'],
  ['catalog/offers/approved.json', 'control/approved.json'],
  ['catalog/ip-capabilities.json', 'control/ip-capabilities.json'],
  ['manifests/CUBE-PUBLIC-SURFACE-MANIFEST.json', 'control/public-surface-manifest.json'],
  ['security/mcp-tool-manifest.json', 'control/mcp-tool-manifest.json'],
  ['security/mcp-tool-manifest.pin.json', 'control/mcp-tool-manifest.pin.json']
];
const FORBIDDEN = [/stripe_secret/i, /webhook_secret/i, /private_key/i, /client_secret/i, /password/i, /authorization:\s*bearer/i];
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function copyOne(srcRel, dstRel) {
  const src = path.join(ROOT, srcRel);
  const dst = path.join(OUT, dstRel);
  if (!fs.existsSync(src)) throw new Error(`Mirror source missing: ${srcRel}`);
  const buf = fs.readFileSync(src);
  const text = buf.toString('utf8');
  for (const rx of FORBIDDEN) if (rx.test(text)) throw new Error(`Mirror secret gate failed: ${srcRel}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, buf);
  return { source: srcRel, mirror: dstRel, sha256: sha256(buf), bytes: buf.length };
}
function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = ALLOW.map(x => copyOne(x[0], x[1]));
  const manifest = { schema_version: 'BEC-COMPILER-MIRROR-1.0', status: 'PASS', compiled_at: new Date().toISOString(), source: 'BEC-PRIME/compiled + control manifests', files, no_secrets_copied: true };
  fs.mkdirSync(path.dirname(PROOF), { recursive: true });
  fs.writeFileSync(PROOF, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}
if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
