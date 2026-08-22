'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRY = path.join(ROOT, 'catalog', 'silos', 'CUBE-SILO-REGISTRY.json');
const OUT = path.join(ROOT, 'compiled', 'website', 'silos.html');
const PROOF = path.join(ROOT, 'PROOF-SILO-DIRECTORY-COMPILATION.json');

const esc = value => String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;'
}[c]));

if (!fs.existsSync(REGISTRY)) throw new Error('Canonical CUBE silo registry missing.');
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const silos = Array.isArray(registry.silos) ? registry.silos : [];
if (silos.length < 1) throw new Error('Refusing to publish an empty silo directory.');

const cards = silos.map((silo, index) => {
  const inventory = silo.inventory_mode || 'mixed';
  const market = silo.market || 'Core';
  const state = silo.status === 'active' ? 'ACTIVE' : String(silo.status || 'UNKNOWN').toUpperCase();
  return `<article class="silo"><div class="eyebrow">${esc(String(index + 1).padStart(2, '0'))} / ${esc(state)}</div><h2>${esc(silo.label)}</h2><p>${esc(inventory)} inventory lane. ${esc(market)} market.</p><div class="foot"><span>${esc(silo.id)}</span><a href="${esc(silo.route)}">Open silo -></a></div></article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="DreamLedger CUBE public silo directory. Independent commerce lanes sharing the same trust and settlement spine.">
<title>DreamLedger | Silo Directory</title>
<style>
:root{--bg:#070707;--panel:#111;--line:#292929;--ink:#f7f7f3;--muted:#8b8b88;--gold:#f2c14e;--green:#32d296}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1400px;margin:auto;padding:0 18px 70px}.nav{height:70px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font-weight:1000;letter-spacing:-.06em;font-size:1.35rem}.brand span,.eyebrow{color:var(--gold)}.nav a{color:var(--muted);text-decoration:none;font-size:.8rem}.hero{padding:70px 0 35px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:.64rem;font-weight:1000}.hero h1{font-size:clamp(3.6rem,8vw,7rem);line-height:.82;letter-spacing:-.09em;margin:14px 0 24px}.hero p{max-width:780px;color:var(--muted);font-size:1rem}.meta{margin-top:18px;color:#777;font:700 .7rem ui-monospace,SFMono-Regular,Consolas,monospace}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.silo{border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,#151515,#0b0b0b);padding:22px;min-height:190px;display:flex;flex-direction:column}.silo h2{margin:9px 0 8px;font-size:1.45rem;letter-spacing:-.05em}.silo p{color:var(--muted);font-size:.8rem;margin:0}.silo .foot{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-top:auto;padding-top:22px}.silo .foot span{color:#666;font:700 .62rem ui-monospace,SFMono-Regular,Consolas,monospace}.silo .foot a{color:var(--gold);font-weight:900;text-decoration:none}.guard{margin-top:18px;border:1px solid var(--line);border-radius:16px;padding:18px;color:#777;font-size:.75rem}.guard strong{color:#ddd}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.grid{grid-template-columns:1fr}.hero{padding-top:45px}}
</style>
</head>
<body>
<div class="wrap">
<header class="nav"><a class="brand" href="/">DREAM<span>LEDGER</span></a><a href="/">Back to commerce</a></header>
<main>
<section class="hero"><div class="eyebrow">CUBE / PUBLIC SILO DIRECTORY</div><h1>Choose a world.<br>Keep the rails.</h1><p>${silos.length} canonical commerce silos are registered in CUBE. Each lane has its own route and inventory context while sharing the common commerce, proof and settlement spine.</p><div class="meta">CANONICAL REGISTRY: CUBE-SILO-REGISTRY/v2</div></section>
<section class="grid">${cards}</section>
<div class="guard"><strong>Economic truth:</strong> a registered silo is not claimed inventory or revenue. New silos start inventory-empty. Offers activate only after verified supply and approval.</div>
</main>
</div>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
fs.writeFileSync(PROOF, JSON.stringify({
  schema: 'BEC-PRIME/SILO-DIRECTORY-COMPILATION/v1',
  status: 'PASS',
  silo_count: silos.length,
  registry: 'BEC-PRIME/catalog/silos/CUBE-SILO-REGISTRY.json',
  output: 'BEC-PRIME/compiled/website/silos.html',
  inventory_rule: 'new_silos_start_inventory_empty',
  compiled_at: new Date().toISOString()
}, null, 2) + '\n', 'utf8');

console.log(`SILO_DIRECTORY_COMPILED=${silos.length}`);
