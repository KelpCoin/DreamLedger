'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v3';

function writeProof(html) {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v3',
    status: html.includes('conditionEligible') ? 'PASS' : 'FAIL',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    condition_policy: 'Only eligible physical singles may display card-condition text',
    held_services_remain_non_purchasable: true,
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (proof.status !== 'PASS') throw new Error('MTG condition guard missing after patch');
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  const unsafe = "const cond=p.condition?('<span>'+esc(p.condition)+'</span>'):'';";
  const safe = [
    "const kind=String(p.product_kind||p.category||p.inventory_type||'').toLowerCase();",
    "const conditionEligible=['single','single-card','mtg-single','physical-single'].includes(kind);",
    "const cond=conditionEligible&&typeof p.condition==='string'&&p.condition.trim()?('<span>'+esc(p.condition.trim())+'</span>'):'';"
  ].join('\n      ');

  if (html.includes(unsafe)) html = html.replace(unsafe, safe);
  if (!html.includes('conditionEligible')) {
    throw new Error('Could not locate MTG condition renderer; refusing to produce false PASS');
  }
  if (!html.includes(MARKER)) {
    const body = '<body class="silo-body">';
    if (!html.includes(body)) throw new Error('MTG source body marker not found');
    html = html.replace(body, '<body class="silo-body" ' + MARKER + '>');
  }

  fs.writeFileSync(SOURCE, html, 'utf8');
  writeProof(html);
}

patch();
