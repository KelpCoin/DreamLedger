'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';
const HELD_CTA = '<span class="silo-btn silo-btn-gold" aria-disabled="true">Purchase held</span>';
const HELD_COPY = 'Digital structure review. Public purchase is held until canonical settlement, attribution, fulfillment, and delivery proof are independently verified.';

function assertHeldDiagnostic(html) {
  const start = html.indexOf('<div class="diag">');
  if (start < 0) throw new Error('Commander diagnostic block not found');
  const end = html.indexOf('</div>', start);
  if (end < 0) throw new Error('Commander diagnostic block is not closed');
  const block = html.slice(start, end + '</div>'.length);

  if (/<a\b[^>]*href=["']https:\/\/buy\.stripe\.com\/[^"']+["'][^>]*>/i.test(block)) {
    throw new Error('Live Stripe link remains in Commander diagnostic block; refusing to compile');
  }
  if (!block.includes(HELD_CTA)) {
    throw new Error('Commander diagnostic has no explicit disabled held CTA');
  }
  if (!block.includes(HELD_COPY)) {
    throw new Error('Commander diagnostic copy does not explain the hold');
  }
}

function writeProof() {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v3',
    status: 'PASS',
    scope: 'source_contract_only_not_deployment_or_revenue_proof',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    route: '/mtg/',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_endpoint: '/data/mtg-catalog.json',
    checkout_endpoint: null,
    diagnostic_checkout_state: 'HELD',
    diagnostic_payment_link_present: false,
    catalogue_layout: 'responsive_grid',
    displays: ['name', 'description', 'price_nzd', 'availability', 'detail_link', 'diagnostic_held_notice'],
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  const original = html;

  const diagStart = html.indexOf('<div class="diag">');
  if (diagStart < 0) throw new Error('Commander diagnostic block not found');
  const diagEnd = html.indexOf('</div>', diagStart);
  if (diagEnd < 0) throw new Error('Commander diagnostic block is not closed');

  let diag = html.slice(diagStart, diagEnd + '</div>'.length);
  const activeCheckout = /<a\b[^>]*href=["']https:\/\/buy\.stripe\.com\/[^"']+["'][^>]*>\s*Buy diagnostic\s*<\/a>/i;
  if (activeCheckout.test(diag)) {
    diag = diag.replace(activeCheckout, HELD_CTA);
  } else if (!diag.includes(HELD_CTA)) {
    throw new Error('Expected either the known diagnostic checkout link or the explicit held CTA');
  }

  diag = diag.replace(/Digital structure review\. Settles on Stripe\. Separate from peer singles and decks\./i, HELD_COPY);
  if (!diag.includes(HELD_COPY)) {
    throw new Error('Commander diagnostic wording does not match the known live or held contract');
  }
  html = html.slice(0, diagStart) + diag + html.slice(diagEnd + '</div>'.length);

  if (!html.includes(MARKER)) {
    const bodyTag = /<body(?=[\s>])/i;
    if (!bodyTag.test(html)) throw new Error('MTG body opening tag not found');
    html = html.replace(bodyTag, '<body ' + MARKER);
  }

  assertHeldDiagnostic(html);

  if (html !== original) {
    fs.writeFileSync(SOURCE, html, 'utf8');
  }
  writeProof();
}

patch();
