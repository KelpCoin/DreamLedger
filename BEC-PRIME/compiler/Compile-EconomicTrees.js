'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'economics', 'ECONOMIC-TREES.json');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'economics');
const OUT = path.join(ROOT, 'catalog', 'compiled', 'economic-tree.json');
const PROOF = path.join(ROOT, 'PROOF-ECONOMIC-TREE-COMPILATION.json');

if (!fs.existsSync(SOURCE)) throw new Error('Missing canonical economic tree input.');
const sourceText = fs.readFileSync(SOURCE, 'utf8');
const source = JSON.parse(sourceText);
if (!source.root || !Array.isArray(source.root.children)) throw new Error('Economic tree root is invalid.');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const digest = crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
const compiled = {
  schema: 'BEC-PRIME/COMPILED-ECONOMIC-TREE/v1',
  status: 'COMPILED',
  compiled_at: new Date().toISOString(),
  source_hash: digest,
  root: source.root,
  economic_loop: source.economic_loop,
  truth_rules: source.truth_rules
};

fs.writeFileSync(OUT, JSON.stringify(compiled, null, 2) + '\n', 'utf8');

const rows = source.root.children.map(node => {
  const offers = (node.offers || []).map(o => `${o.sku} - NZD ${o.price_nzd} - ${o.status}`).join('<br>') || 'No canonical offer yet.';
  return `<section><h2>${node.name}</h2><p>${offers}</p><small>${node.constraint || 'UNSPECIFIED'}</small></section>`;
}).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger | Economic Trees</title><style>body{margin:0;background:#090a0d;color:#f4f1eb;font:16px/1.55 system-ui}.wrap{max-width:1000px;margin:auto;padding:32px 20px 60px}section{border:1px solid #303541;background:#151820;border-radius:16px;padding:18px;margin:14px 0}p{color:#b9bec8}small{color:#8e96a5}</style></head><body><main class="wrap"><a href="/">DreamLedger</a><h1>Economic Trees</h1><p>Canonical economic routing compiled by BEC-PRIME. This surface describes priorities and state transitions. It does not claim revenue.</p>${rows}<section><h2>Loop</h2><p>${source.economic_loop.join(' -> ')}</p></section><section><h2>Truth Gate</h2><p>Gauntlet PASS is not revenue. Revenue requires a verified payment event and proof.</p></section></main></body></html>`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');

const proof = {
  schema: 'BEC-PRIME/ECONOMIC-TREE-COMPILATION/v1',
  status: 'PASS',
  source_hash: digest,
  output: ['catalog/compiled/economic-tree.json', 'compiled/website/economics/index.html'],
  guarantees: source.truth_rules
};
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
