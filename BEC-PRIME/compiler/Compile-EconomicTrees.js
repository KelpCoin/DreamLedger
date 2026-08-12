'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'economics', 'ECONOMIC-TREES.json');
const IP_SOURCE = path.join(ROOT, 'economics', 'IP-ECONOMIC-COMPILATION.json');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'economics');
const OUT = path.join(ROOT, 'catalog', 'compiled', 'economic-tree.json');
const IP_OUT = path.join(OUT_DIR, 'ip-manifest.json');
const PROOF = path.join(ROOT, 'PROOF-ECONOMIC-TREE-COMPILATION.json');

if (!fs.existsSync(SOURCE)) throw new Error('Missing canonical economic tree input.');
if (!fs.existsSync(IP_SOURCE)) throw new Error('Missing canonical IP-economic compilation input.');
const sourceText = fs.readFileSync(SOURCE, 'utf8');
const ipText = fs.readFileSync(IP_SOURCE, 'utf8');
const source = JSON.parse(sourceText);
const ip = JSON.parse(ipText);
if (!source.root || !Array.isArray(source.root.children)) throw new Error('Economic tree root is invalid.');
if (!Array.isArray(ip.ip_nodes) || !Array.isArray(ip.economic_loop)) throw new Error('IP-economic compilation contract is invalid.');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const sourceHash = crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
const ipHash = crypto.createHash('sha256').update(ipText, 'utf8').digest('hex');
const compiled = {
  schema: 'BEC-PRIME/COMPILED-ECONOMIC-TREE/v2',
  status: 'COMPILED',
  compiled_at: new Date().toISOString(),
  source_hash: sourceHash,
  ip_contract_hash: ipHash,
  root: source.root,
  economic_loop: source.economic_loop,
  truth_rules: source.truth_rules,
  ip_nodes: ip.ip_nodes
};

fs.writeFileSync(OUT, JSON.stringify(compiled, null, 2) + '\n', 'utf8');
fs.writeFileSync(IP_OUT, JSON.stringify({
  schema: 'BEC-PRIME/COMPILED-IP-MANIFEST/v1',
  status: 'COMPILED',
  compiled_at: compiled.compiled_at,
  source_hash: ipHash,
  public_surface: ip.public_surface,
  compiler_authority: ip.compiler_authority,
  ip_nodes: ip.ip_nodes,
  economic_loop: ip.economic_loop,
  truth_boundary: ip.truth_boundary,
  public_boundary: ip.public_boundary
}, null, 2) + '\n', 'utf8');

const rows = source.root.children.map(node => {
  const offers = (node.offers || []).map(o => `${o.sku} - NZD ${o.price_nzd} - ${o.status}`).join('<br>') || 'No canonical offer yet.';
  return `<section><h2>${node.name}</h2><p>${offers}</p><small>${node.constraint || 'UNSPECIFIED'}</small></section>`;
}).join('\n');
const ipRows = ip.ip_nodes.map(node => `<li><strong>${node.id}</strong> - ${node.role} <code>${node.path}</code></li>`).join('');
const loop = ip.economic_loop.join(' -> ');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger | BEC-PRIME Economic Kernel</title><style>body{margin:0;background:#090a0d;color:#f4f1eb;font:16px/1.55 system-ui}.wrap{max-width:1000px;margin:auto;padding:32px 20px 60px}section{border:1px solid #303541;background:#151820;border-radius:16px;padding:18px;margin:14px 0}p{color:#b9bec8}small{color:#8e96a5}code{color:#9da7b7}a{color:#fff}</style></head><body><main class="wrap"><a href="/">DreamLedger</a><h1>BEC-PRIME Economic Kernel</h1><p>DreamLedger is compiled from the BEC-PRIME canonical economic tree and IP contract. This surface exposes architecture and state, not fabricated revenue.</p>${rows}<section><h2>IP Kernel</h2><ul>${ipRows}</ul></section><section><h2>Economic Loop</h2><p>${loop}</p></section><section><h2>Truth Gate</h2><p>Gauntlet PASS is not revenue. Revenue requires a verified payment event and proof.</p></section></main></body></html>`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');

const proof = {
  schema: 'BEC-PRIME/ECONOMIC-TREE-COMPILATION/v2',
  status: 'PASS',
  source_hash: sourceHash,
  ip_contract_hash: ipHash,
  output: ['catalog/compiled/economic-tree.json', 'compiled/website/economics/index.html', 'compiled/website/economics/ip-manifest.json'],
  guarantees: source.truth_rules
};
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
