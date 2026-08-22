'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'compiled', 'website');
const PROOF = path.join(ROOT, 'data', 'proofs', 'compiler-leverage-latest.json');

fs.mkdirSync(PUBLIC, { recursive: true });
const proof = fs.existsSync(PROOF) ? JSON.parse(fs.readFileSync(PROOF, 'utf8')) : { status: 'PENDING' };

const copyIfPresent = (source, target) => {
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(PUBLIC, target));
};
copyIfPresent(path.join(ROOT, '..', 'gauntlet.html'), 'gauntlet.html');
copyIfPresent(path.join(ROOT, '..', 'elohim-refinery.html'), 'elohim-refinery.html');
copyIfPresent(path.join(ROOT, '..', 'trust-engine.html'), 'trust-engine.html');

const esc = v => String(v == null ? '' : v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BrownEye Cortex | Compiler Control</title>
<style>body{margin:0;background:#080808;color:#eee;font:16px/1.5 system-ui,sans-serif}.wrap{max-width:1050px;margin:auto;padding:28px}.eyebrow{color:#f2c14e;font-weight:900;letter-spacing:.14em;font-size:.65rem}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px}.card{border:1px solid #2b2b2b;border-radius:18px;padding:20px;background:#111}.ok{color:#43d39a}.muted{color:#888}.btn{display:inline-block;margin-top:12px;padding:10px 14px;border:1px solid #444;border-radius:10px;color:#fff;text-decoration:none}.hero{padding:30px 0}.hero h1{font-size:clamp(3rem,7vw,6rem);line-height:.85;letter-spacing:-.08em;margin:10px 0}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style>
</head>
<body><div class="wrap"><div class="eyebrow">BROWNEYE CORTEX / CONTROL SURFACE</div><div class="hero"><h1>Compile hard.<br>Prove harder.</h1><p class="muted">DreamMeez is the first integrated world. The same compiler, Gauntlet and Elohim control path can generate and vet additional worlds and playable artifacts.</p></div>
<div class="grid"><article class="card"><div class="eyebrow">COMPILER</div><h2>Leverage Gate</h2><p class="${proof.status==='PASS'?'ok':''}">Status: ${esc(proof.status)}</p><p class="muted">Elohim proposal + deterministic artifact checks are part of compilation.</p><a class="btn" href="/compiler-proof/pong.html">Open Pong proof</a><a class="btn" href="/leverage-registry.html">Open 401-500 registry</a></article>
<article class="card"><div class="eyebrow">GAUNTLET</div><h2>Quality Gate</h2><p class="muted">Artifact integrity, browser-ready shell, game loop, and secret-safety checks.</p><a class="btn" href="/gauntlet.html">Open Gauntlet</a></article>
<article class="card"><div class="eyebrow">ELOHIM</div><h2>Proposal Engine</h2><p class="muted">Proposes assets and actions while keeping publish, charge, and external execution approval-gated.</p><a class="btn" href="/elohim-refinery.html">Open Elohim</a></article></div>
<div class="card" style="margin-top:14px"><div class="eyebrow">WORLD 01</div><h2>DreamMeez</h2><p class="muted">Account, avatars, streaks, rewards and the first world-level economy are already present in the canonical tree.</p><a class="btn" href="/dreammeez">Enter DreamMeez</a></div>
</div></body></html>`;
fs.writeFileSync(path.join(PUBLIC, 'cortex.html'), html, 'utf8');
console.log('PASS: Cortex control surface published.');
