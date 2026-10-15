'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';
const CONDITION_LINE = "const cond=p.condition?('<span>'+esc(p.condition)+'</span>'):'';";
const SAFE_CONDITION_LINE = "const conditionEligible=['single','single-card','mtg-single','physical-single'].includes(String(p.product_kind||p.category||p.inventory_type||'').toLowerCase());\n        const cond=conditionEligible&&typeof p.condition==='string'&&p.condition.trim()?('<span>'+esc(p.condition.trim())+'</span>'):'';";

function writeProof(html) {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v2',
    status: html.includes(MARKER) && html.includes('conditionEligible') ? 'PASS' : 'BLOCKED',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_endpoint: '/data/mtg-catalog.json',
    checkout_endpoint: null,
    horizontal_catalogue: /overflow-x:\s*auto/i.test(html),
    displays: ['image', 'name', 'price_nzd', 'availability', 'condition_for_verified_singles_only'],
    checkout_policy: 'No checkout route is declared by this renderer; no checkout is enabled by this patch.',
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (proof.status !== 'PASS') throw new Error('MTG commerce surface proof blocked: required guard is absent');
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');

  if (!html.includes('conditionEligible')) {
    if (!html.includes(CONDITION_LINE)) {
      throw new Error('MTG condition-render boundary not found; refusing to guess at a renderer rewrite');
    }
    html = html.replace(CONDITION_LINE, SAFE_CONDITION_LINE);
  }

  if (!html.includes(MARKER)) {
    const body = /<body(?:\s[^>]*)?>/i;
    if (!body.test(html)) throw new Error('MTG body boundary not found');
    html = html.replace(body, match => match.replace(/>$/, ' ' + MARKER + '>'));
  }

  if (!html.includes('conditionEligible') || !html.includes(MARKER)) {
    throw new Error('MTG commerce patch did not establish all required guards');
  }

  fs.writeFileSync(SOURCE, html, 'utf8');
  writeProof(html);
}

patch();
