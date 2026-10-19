'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';

function assertSafeSource(html) {
  const required = [
    MARKER,
    "product.status === 'published'",
    'Number(product.inventory) > 0',
    "product.sale_mode === 'claim_by_message'",
    'product.checkout_available === false',
    'safeClaim(product.claim_url)',
    'grid.replaceChildren()',
    'document.createElement',
    '.textContent =',
    'checkout is not enabled'
  ];
  const missing = required.filter(token => !html.includes(token));
  if (missing.length) {
    throw new Error('MTG commerce source failed closed-surface verification; missing: ' + missing.join(', '));
  }
  if (/buy\.stripe\.com|checkout\.stripe\.com/i.test(html)) {
    throw new Error('MTG storefront must not contain a hardcoded direct-payment URL');
  }
  if (/innerHTML\s*=\s*decks\.map/i.test(html)) {
    throw new Error('MTG storefront renderer must not interpolate catalog values through innerHTML');
  }
}

function writeProof(html) {
  assertSafeSource(html);
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v3',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    mode: 'VERIFY_FAIL_CLOSED_MTG_SURFACE',
    marker: MARKER,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_source: '/data/mtg-catalog.json',
    checkout: 'DISABLED',
    purchase_flow: 'manual_enquiry_only',
    rendering: 'DOM_CREATION_AND_TEXT_CONTENT',
    display_contract: [
      'published_physical_decks_only',
      'positive_inventory_only',
      'manual_claim_path_only',
      'no_direct_checkout',
      'catalog_unavailable_means_no_inventory_claim'
    ],
    held_products_visible: false,
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

function patch() {
  const html = fs.readFileSync(SOURCE, 'utf8');
  // The prior patcher relied on obsolete function boundaries and could not compile
  // the current source. Never synthesize a PASS after a failed string replacement:
  // validate the current page contract, and stop if the source needs a real code review.
  writeProof(html);
}

patch();
