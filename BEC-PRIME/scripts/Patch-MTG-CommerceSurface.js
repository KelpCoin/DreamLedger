'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';
const BASE_GRID = '.grid{display:grid;gap:16px;grid-template-columns:1fr}';
const RAIL_GRID = '.grid{display:flex;gap:14px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding:10px 2px 22px;scrollbar-width:thin}.grid>.deck{flex:0 0 min(330px,82vw);scroll-snap-align:start}';

function writeProof(patchMode) {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v2',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    patch_mode: patchMode,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_endpoint: '/api/products',
    catalog_path: '/data/mtg-catalog.json',
    checkout_endpoint: '/api/offer-checkout/create',
    horizontal_catalogue: true,
    purchase_claim: 'A listing is purchasable only if its detail route confirms availability; this patch does not activate payments.',
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  const hasCatalogContract = html.includes('id="grid"')
    && html.includes('id="status"')
    && html.includes("const CATALOG='/data/mtg-catalog.json'")
    && html.includes('async function load()');

  if (!hasCatalogContract) {
    throw new Error('MTG catalogue template is not the supported grid/status/catalog variant; refusing unsafe rewrite.');
  }

  if (html.includes(MARKER)) {
    if (!html.includes(RAIL_GRID)) {
      throw new Error('MTG commerce marker exists but horizontal catalogue CSS is missing.');
    }
    writeProof('already-patched');
    return;
  }

  if (!html.includes(BASE_GRID)) {
    throw new Error('MTG base grid CSS did not match known template; refusing to patch ambiguous markup.');
  }

  const original = html;
  html = html.replace(BASE_GRID, RAIL_GRID);
  const bodyTag = '<body class="silo-body">';
  if (!html.includes(bodyTag)) {
    throw new Error('MTG body tag did not match known template; refusing to patch ambiguous markup.');
  }
  html = html.replace(bodyTag, '<body class="silo-body" ' + MARKER + '>');
  if (html === original || !html.includes(MARKER) || !html.includes(RAIL_GRID)) {
    throw new Error('MTG commerce patch did not apply its required changes.');
  }

  fs.writeFileSync(SOURCE, html, 'utf8');
  writeProof('grid-to-horizontal-rail');
}

patch();
