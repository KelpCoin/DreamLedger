'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';
const HELD_ROUTE = '/buy/COMMANDER-DECK-DIAGNOSTIC-001';
const LEGACY_CHECKOUT_URL = 'https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I';

function writeProof() {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v2',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_endpoint: '/api/products',
    checkout_endpoint: HELD_ROUTE,
    checkout_state: 'HELD_UNTIL_SETTLEMENT_ENTITLEMENT_AND_DELIVERY_VERIFICATION',
    public_sale_authorized: false,
    horizontal_catalogue: false,
    displays: ['image', 'name', 'price_nzd', 'availability', 'condition_for_verified_singles_only'],
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  const rendererContractPresent =
    html.includes('function conditionEligible(p)') &&
    html.includes('conditionEligible(p)&&typeof p.condition') &&
    !html.includes(LEGACY_CHECKOUT_URL);

  if (html.includes(MARKER) && rendererContractPresent) {
    writeProof();
    return;
  }

  const original = html;
  const physicalMatcher = "function isPhysical(p){return p.category==='commander-deck'||/^EDH/i.test(p.id||'');}";
  const physicalMatcherPatched = `${physicalMatcher}\n  function conditionEligible(p){const kind=String(p.product_kind||p.category||p.inventory_type||'').toLowerCase();return ['single','single-card','mtg-single','physical-single'].includes(kind);}`;

  if (!html.includes('function conditionEligible(p)')) {
    if (!html.includes(physicalMatcher)) {
      throw new Error('MTG catalog source boundary changed; refusing an unreviewed renderer rewrite');
    }
    html = html.replace(physicalMatcher, physicalMatcherPatched);
  }

  const oldCondition = "const cond=p.condition?('<span>'+esc(p.condition)+'</span>'):'';";
  const newCondition = "const cond=conditionEligible(p)&&typeof p.condition==='string'&&p.condition.trim()?('<span>'+esc(p.condition.trim())+'</span>'):'';";
  if (!html.includes(newCondition)) {
    if (!html.includes(oldCondition)) {
      throw new Error('MTG condition renderer boundary changed; refusing an unsafe condition patch');
    }
    html = html.replace(oldCondition, newCondition);
  }

  if (html.includes(LEGACY_CHECKOUT_URL)) {
    html = html.replace(LEGACY_CHECKOUT_URL, HELD_ROUTE);
  }

  if (!/<body\b[^>]*>/i.test(html)) throw new Error('MTG body boundary missing');
  html = html.replace(/<body\b([^>]*)>/i, (_match, attributes) => {
    if (attributes.includes(MARKER)) return '<body' + attributes + '>';
    return '<body' + attributes + ' ' + MARKER + '>';
  });

  if (!html.includes('function conditionEligible(p)') ||
      !html.includes('conditionEligible(p)&&typeof p.condition') ||
      html.includes(LEGACY_CHECKOUT_URL) ||
      !html.includes(MARKER)) {
    throw new Error('MTG commerce patch postcondition failed');
  }
  if (html === original) throw new Error('MTG commerce patch made no changes');

  fs.writeFileSync(SOURCE, html, 'utf8');
  writeProof();
}

patch();
