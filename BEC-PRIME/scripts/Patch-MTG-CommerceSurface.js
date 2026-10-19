'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';
const HORIZONTAL_GRID_MARKER = 'flex:0 0 min(330px,82vw)';

function writeProof() {
  const html = fs.readFileSync(SOURCE, 'utf8');
  const horizontal = html.includes(HORIZONTAL_GRID_MARKER) &&
    html.includes('scroll-snap-type:x mandatory') &&
    html.includes('function conditionEligible(p)');
  if (!horizontal) throw new Error('MTG surface proof refused: horizontal listing or condition guard absent');

  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v3',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_endpoint: '/data/mtg-catalog.json',
    checkout_endpoint: null,
    horizontal_catalogue: horizontal,
    displays: ['name', 'price_nzd', 'availability', 'listing_detail_link'],
    checkout_active: false,
    checkout_rule: 'Listing-detail navigation only. Keep direct checkout disabled until canonical payment-to-delivery acceptance passes.',
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');

  if (!html.includes('async function load(){') ||
      !html.includes('function isPhysical(p)') ||
      !html.includes('function conditionEligible(p)') ||
      !html.includes("fetch(CATALOG,{cache:'no-store'})") ||
      !html.includes("p.detail_url||'/mtg/'")) {
    throw new Error('MTG catalog source does not match the supported listing-detail contract');
  }

  // The marker alone is not enough. Previous revisions could add it without
  // applying the layout. Verify the actual horizontal CSS before no-op.
  if (html.includes(MARKER) && html.includes(HORIZONTAL_GRID_MARKER)) {
    writeProof();
    return;
  }

  const desktopGrid = html.match(/\.grid\{display:grid;gap:\\d+px;grid-template-columns:1fr\}/);
  if (!desktopGrid) {
    throw new Error('MTG listing grid CSS anchor not found');
  }

  const horizontalGrid = '.grid{display:flex;gap:14px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding:10px 2px 22px;scrollbar-width:thin}.grid>.deck{flex:0 0 min(330px,82vw);scroll-snap-align:start}';
  let updated = html.replace(desktopGrid[0], horizontalGrid);
  updated = updated.replace('@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}', '');
  updated = updated.replace('@media(min-width:960px){.grid{grid-template-columns:1fr 1fr 1fr}}', '');

  const bodyTag = updated.match(/<body\b[^>]*>/i);
  if (!bodyTag) throw new Error('MTG body element not found');
  if (updated === html) throw new Error('MTG commerce surface patch made no changes');

  if (!updated.includes(MARKER)) {
    const markedBody = bodyTag[0].slice(0, -1) + ' ' + MARKER + '>';
    updated = updated.replace(bodyTag[0], markedBody);
  }

  fs.writeFileSync(SOURCE, updated, 'utf8');
  writeProof();
}

patch();
