'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');
const PROOF = path.join(ROOT, 'PROOF-PUBLIC-SURFACE-CONTRACT-PATCH.json');
const marker = 'private implementation material is not a public surface';
if (!fs.existsSync(INDEX)) throw new Error('PUBLIC_SURFACE_CONTRACT_INPUT_MISSING');
let html = fs.readFileSync(INDEX, 'utf8');
if (!html.toLowerCase().includes(marker)) {
  html = html.replace('</footer>', '<p class="note">Private implementation material is not a public surface.</p></footer>');
  fs.writeFileSync(INDEX, html, 'utf8');
}
const proof = { schema: 'BEC-PUBLIC-SURFACE-CONTRACT/v1', status: html.toLowerCase().includes(marker) ? 'PASS' : 'FAIL', patched_at: new Date().toISOString(), marker_present: html.toLowerCase().includes(marker) };
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
if (proof.status !== 'PASS') process.exit(1);
