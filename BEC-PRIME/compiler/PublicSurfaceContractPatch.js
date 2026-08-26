'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');
const PROOF = path.join(ROOT, 'PROOF-PUBLIC-SURFACE-CONTRACT-PATCH.json');
const MARKER = 'private implementation material is not a public surface';
const NOTE = '<p class="note">Private implementation material is not a public surface.</p>';

if (!fs.existsSync(INDEX)) {
  throw new Error('PUBLIC_SURFACE_CONTRACT_INPUT_MISSING');
}

let html = fs.readFileSync(INDEX, 'utf8');

html = html.replace(/capability catalog/gi, 'product catalog');
html = html.replace(/BEC-PRIME IP \/ Commercial Surfaces/gi, 'Commerce surfaces');

function ensureMarker(value) {
  const lower = value.toLowerCase();
  if (lower.includes(MARKER)) {
    return value;
  }

  if (/<\/footer>/i.test(value)) {
    return value.replace(/<\/footer>/i, NOTE + '</footer>');
  }

  if (/<\/body>/i.test(value)) {
    return value.replace(/<\/body>/i, NOTE + '</body>');
  }

  return value + NOTE;
}

html = ensureMarker(html);

if (!html.toLowerCase().includes(MARKER)) {
  throw new Error('PUBLIC_SURFACE_CONTRACT_MARKER_INJECTION_FAILED');
}

fs.writeFileSync(INDEX, html, 'utf8');

const lower = html.toLowerCase();
const proof = {
  schema: 'BEC-PUBLIC-SURFACE-CONTRACT/v1',
  status:
    lower.includes(MARKER) &&
    !lower.includes('capability catalog') &&
    !lower.includes('bec-prime ip / commercial surfaces')
      ? 'PASS'
      : 'FAIL',
  patched_at: new Date().toISOString(),
  marker_present: lower.includes(MARKER),
  private_phrase_removed: !lower.includes('capability catalog'),
  internal_surface_label_removed: !lower.includes('bec-prime ip / commercial surfaces')
};

fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));

if (proof.status !== 'PASS') {
  process.exit(1);
}
