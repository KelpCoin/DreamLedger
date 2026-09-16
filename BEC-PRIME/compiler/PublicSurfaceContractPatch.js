'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const INDEX = path.join(OUT, 'index.html');
const PROOF = path.join(ROOT, 'PROOF-PUBLIC-SURFACE-CONTRACT-PATCH.json');
const MARKER = 'private implementation material is not a public surface';
const NOTE = '<p class="note">Private implementation material is not a public surface.</p>';

if (!fs.existsSync(INDEX)) {
  throw new Error('PUBLIC_SURFACE_CONTRACT_INPUT_MISSING');
}

let html = fs.readFileSync(INDEX, 'utf8');

html = html.replace(/capability catalog/gi, 'product catalog');
html = html.replace(/BEC-PRIME IP \/ Commercial Surfaces/gi, 'Commerce surfaces');

// The public-surface verifier requires canonical storefront doors to be
// discoverable from the generated catalogue. Keep these as real links, not
// verifier-only tokens. DreamMeez is an explicit public alias for the
// existing DreamMeez account/avatar surface; Truth Oracle is the published
// public verification surface.
const requiredDoors = '<nav aria-label="Canonical public doors"><a href="/dreammeez">DreamMeez</a><a href="/truth-oracle.html">Truth Oracle</a></nav>';
if (!/href=["']\/dreammeez["']/i.test(html) || !/href=["']\/truth-oracle\.html["']/i.test(html)) {
  html = html.replace(/<\/main>/i, requiredDoors + '</main>');
}

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

// Materialize the canonical DreamMeez alias so the catalogue door resolves
// to a real public surface instead of being a label-only link.
const dreamMeezDir = path.join(OUT, 'dreammeez');
fs.mkdirSync(dreamMeezDir, { recursive: true });
const dreamMeezPage = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamMeez | DreamLedger</title></head><body><main><h1>DreamMeez</h1><p>DreamMeez is the DreamLedger account and avatar surface.</p><p><a href="/avatar.html">Open avatar</a></p><p><a href="/">Back to DreamLedger</a></p></main></body></html>\n';
fs.writeFileSync(path.join(dreamMeezDir, 'index.html'), dreamMeezPage, 'utf8');

const lower = html.toLowerCase();
const proof = {
  schema: 'BEC-PUBLIC-SURFACE-CONTRACT/v2',
  status:
    lower.includes(MARKER) &&
    !lower.includes('capability catalog') &&
    !lower.includes('bec-prime ip / commercial surfaces') &&
    /href=["']\/dreammeez["']/i.test(html) &&
    /href=["']\/truth-oracle\.html["']/i.test(html)
      ? 'PASS'
      : 'FAIL',
  patched_at: new Date().toISOString(),
  marker_present: lower.includes(MARKER),
  private_phrase_removed: !lower.includes('capability catalog'),
  internal_surface_label_removed: !lower.includes('bec-prime ip / commercial surfaces'),
  canonical_doors_present: {
    dreammeez: /href=["']\/dreammeez["']/i.test(html),
    truth_oracle: /href=["']\/truth-oracle\.html["']/i.test(html)
  },
  dreammeez_alias_compiled: fs.existsSync(path.join(dreamMeezDir, 'index.html'))
};

fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));

if (proof.status !== 'PASS') {
  process.exit(1);
}
