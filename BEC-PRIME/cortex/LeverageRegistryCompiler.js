'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRY = path.join(__dirname, 'LEVERAGE-REGISTRY-401-500.json');
const PUBLIC = path.join(ROOT, 'compiled', 'website');
const PROOF = path.join(ROOT, 'data', 'proofs');

function load() {
  const data = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  if (!Array.isArray(data.entries) || data.entries.length !== 100) throw new Error('Leverage registry must contain exactly 100 entries');
  const ids = data.entries.map(x => Number(x.id));
  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i] !== 401 + i) throw new Error(`Leverage registry sequence error at ${ids[i]}`);
  }
  for (const entry of data.entries) {
    if (!entry.name || !entry.owner || !entry.hook || !entry.economic_effect || !entry.evidence) throw new Error(`Incomplete leverage entry ${entry.id}`);
  }
  return data;
}

function render(data) {
  const grouped = {};
  for (const e of data.entries) (grouped[e.owner] ||= []).push(e);
  const sections = Object.entries(grouped).map(([owner, entries]) => `
    <section class="group"><h2>${owner}</h2><div class="grid">${entries.map(e => `<article><b>#${e.id} ${e.name}</b><span>hook: ${e.hook}</span><p>${e.economic_effect}</p><small>evidence: ${e.evidence}</small></article>`).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cortex Leverage Registry 401-500</title><style>body{margin:0;background:#080808;color:#eee;font:14px/1.45 system-ui,sans-serif}.wrap{max-width:1200px;margin:auto;padding:28px}.hero{padding:30px 0}.hero h1{font-size:clamp(2.5rem,7vw,5rem);line-height:.9;letter-spacing:-.08em;margin:8px 0}.hero p{color:#8d8d8d;max-width:760px}.group{margin:30px 0}.group h2{color:#f2c14e;text-transform:uppercase;letter-spacing:.12em;font-size:.8rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px}.group article{background:#121212;border:1px solid #272727;border-radius:14px;padding:14px}.group b{display:block}.group span,.group small{display:block;color:#777;font-size:.72rem;margin-top:5px}.group p{color:#aaa;margin:9px 0}</style></head><body><div class="wrap"><div class="hero"><div style="color:#f2c14e;font-weight:900;letter-spacing:.15em;font-size:.7rem">BROWN EYE CORTEX / LEVERAGE</div><h1>401-500</h1><p>Machine-readable leverage registry. Every capability maps to a reusable subsystem, an economic effect, and an evidence contract.</p></div>${sections}</div></body></html>`;
}

function compile() {
  const data = load();
  fs.mkdirSync(PUBLIC, { recursive: true });
  fs.mkdirSync(PROOF, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, 'leverage-registry.html'), render(data), 'utf8');
  const proof = {
    schema: 'bec-prime/leverage-registry-proof/v1',
    generated_at: new Date().toISOString(),
    range: data.range,
    count: data.entries.length,
    owners: [...new Set(data.entries.map(x => x.owner))].sort(),
    status: 'PASS'
  };
  fs.writeFileSync(path.join(PROOF, 'leverage-registry-latest.json'), JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { load, compile };
