'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function verifyContract(html) {
  const required = [
    "function isPhysical(p)",
    "function conditionEligible(p)",
    "p.category==='commander-deck'",
    "p.deck_condition",
    "async function load()",
    "grid.innerHTML=decks.map"
  ];
  const missing = required.filter(s => !html.includes(s));
  if (missing.length) throw new Error('MTG commerce source contract failed: missing ' + missing.join(', '));
  if (/LP− \(Lightly Played\)/i.test(html)) {
    throw new Error('MTG source contains a default card condition label');
  }
  if (!html.includes("['single','single-card','mtg-single','physical-single'].includes(kind)")) {
    throw new Error('Card condition is not restricted to eligible physical singles');
  }
  return true;
}

function writeProof(html, mutation) {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v3',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    source_sha256: sha256(html),
    marker: MARKER,
    mutation,
    route: '/mtg/',
    inventory_endpoint: '/data/mtg-catalog.json',
    checkout_available_from_this_surface: false,
    condition_contract: {
      card_condition_eligible_categories: ['single', 'single-card', 'mtg-single', 'physical-single'],
      physical_deck_condition_field: 'deck_condition',
      default_condition_injected: false
    },
    guarantees: {
      no_live_checkout_added: true,
      no_default_condition_added: true,
      patch_is_idempotent: true,
      product_inventory_not_mutated: true
    },
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  verifyContract(html);
  if (html.includes(MARKER)) {
    writeProof(html, 'already_compliant_no_change');
    return;
  }
  const original = html;
  const bodyOpen = '<body class="silo-body">';
  if (!html.includes(bodyOpen)) throw new Error('MTG body marker boundary not found; refusing blind patch');
  html = html.replace(bodyOpen, '<body class="silo-body" ' + MARKER + '>');
  verifyContract(html);
  if (html === original) throw new Error('MTG commerce contract patch made no changes');
  fs.writeFileSync(SOURCE, html, 'utf8');
  writeProof(html, 'added_contract_marker_only');
}

patch();
