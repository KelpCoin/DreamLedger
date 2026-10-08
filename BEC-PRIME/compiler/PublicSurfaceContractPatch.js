'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');
const PROOF = path.join(ROOT, 'PROOF-PUBLIC-SURFACE-CONTRACT-PATCH.json');
const MARKER = 'before buying, review the price, included services and delivery details';
const NOTE = '<p class="note">Before buying, review the price, included services and delivery details.</p>';

if (!fs.existsSync(INDEX)) {
  throw new Error('PUBLIC_SURFACE_CONTRACT_INPUT_MISSING');
}

let html = fs.readFileSync(INDEX, 'utf8');

html = html.replace(/capability catalog/gi, 'product catalog');
html = html.replace(/Economic Observatory/gi, 'Market Updates');
html = html.replace(/MASTER SILO/gi, 'CARDS &amp; DECKS');
html = html.replace(/master commerce template/gi, 'marketplace');
html = html.replace(/Money membrane/gi, 'Supplier Quote Comparison');
html = html.replace(/Fresh shelf/gi, 'New arrivals');
html = html.replace(/Pioneer product/gi, 'Featured product');
html = html.replace(/BUILD CANDIDATE/gi, 'COMING SOON');
html = html.replace(/VERIFIED EXTERNAL REVENUE/gi, 'INDEPENDENTLY VERIFIED SALES');
html = html.replace(/internal activity/gi, 'unverified activity');
html = html.replace(/current economic pulse/gi, 'latest market updates');
html = html.replace(/economic pulse/gi, 'market updates');
html = html.replace(/\bSILO\b/gi, 'SECTION');
html = html.replace(/\bsilos\b/gi, 'sections');
html = html.replace(/\blanes\b/gi, 'categories');
html = html.replace(/\blane\b/gi, 'category');
html = html.replace(/activation/gi, 'launch');
html = html.replace(/approval-gated/gi, 'reviewed before publication');
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
    !lower.includes('bec-prime ip / commercial surfaces') &&
    !lower.includes('master silo') && !lower.includes('internal activity')
      ? 'PASS'
      : 'FAIL',
  patched_at: new Date().toISOString(),
  marker_present: lower.includes(MARKER),
  private_phrase_removed: !lower.includes('private implementation material'),
  internal_surface_label_removed: !lower.includes('bec-prime ip / commercial surfaces')
};

fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));

if (proof.status !== 'PASS') {
  process.exit(1);
}
