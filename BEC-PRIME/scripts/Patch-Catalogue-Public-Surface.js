'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="DreamLedger catalogue doorway for isolated product and proof surfaces.">
<meta name="theme-color" content="#090b0f">
<title>DreamLedger | Catalogue</title>
<style>
:root{--bg:#090b0f;--panel:#11151b;--line:#29313a;--ink:#f5f3eb;--muted:#9da7b1;--gold:#d8b56b;--max:1180px}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#252015 0,#090b0f 34%);color:var(--ink);font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:var(--max);margin:auto;padding:0 18px 70px}.nav{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:20px 0;border-bottom:1px solid var(--line)}.brand{font-weight:950;letter-spacing:.08em;color:var(--ink);text-decoration:none}.brand b{color:var(--gold)}.navlinks{display:flex;gap:12px;flex-wrap:wrap}.navlinks a{color:var(--muted);text-decoration:none}.hero{padding:64px 0 34px}.kicker{font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}h1{font-size:clamp(48px,9vw,100px);line-height:.88;letter-spacing:-.065em;margin:12px 0 20px;max-width:900px}.hero p{max-width:760px;color:var(--muted);font-size:19px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.btn{display:inline-block;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:900;border:1px solid var(--line);color:var(--ink)}.btn.primary{background:var(--gold);color:#111;border-color:var(--gold)}.section{margin-top:42px}.section h2{font-size:28px;margin:0 0 8px}.muted{color:var(--muted)}.rail{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:14px 2px 24px;margin-right:-18px;padding-right:18px;overscroll-behavior-x:contain}.rail::-webkit-scrollbar{height:8px}.rail::-webkit-scrollbar-thumb{background:#38414a;border-radius:999px}.card{flex:0 0 min(82vw,340px);scroll-snap-align:start;background:linear-gradient(180deg,#151b22,#0e1217);border:1px solid var(--line);border-radius:20px;padding:22px;min-height:330px;display:flex;flex-direction:column;justify-content:space-between}.card .mark{font-size:42px;font-weight:950;letter-spacing:-.08em;color:var(--gold)}.card h3{font-size:25px;margin:10px 0 6px}.card p{color:var(--muted);font-size:14px}.tag{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:5px 9px;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.proof{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.proof article{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px}.proof strong{display:block;font-size:20px}.proof span{display:block;color:var(--muted);font-size:13px;margin-top:5px}.footer{margin-top:54px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}@media(max-width:700px){.proof{grid-template-columns:1fr}.nav{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
<header class="nav"><a class="brand" href="/">DREAM<b>LEDGER</b></a><nav class="navlinks"><a href="/mtg">MTG</a><a href="/cinema.html">Cinema</a><a href="/digital-products.html">Digital Products</a><a href="/avatar.html">Avatar</a></nav></header>
<main>
<section class="hero"><div class="kicker">Economic memory / proof / access</div><h1>The catalogue is the product surface.</h1><p>DreamLedger is not a single-offer landing page. This doorway exposes working product and proof surfaces while keeping their commercial silos separate.</p><div class="actions"><a class="btn primary" href="#catalogue">Open catalogue</a><a class="btn" href="/avatar.html">Open avatar</a></div></section>
<section class="section" id="catalogue"><div class="kicker">Horizontal catalogue</div><h2>Choose a doorway</h2><p class="muted">Swipe horizontally on mobile. Each card leads to an isolated surface.</p>
<div class="rail">
<article class="card"><div><span class="tag">MTG / CUBE silo</span><div class="mark">MTG</div><h3>Magic: The Gathering</h3><p>Canonical MTG catalogue, Commander surfaces, deterministic Monte Carlo and the Cinema proof layer. The automated Commander diagnostic lives inside this silo, not on the DreamLedger home page.</p></div><div><a class="btn primary" href="/mtg">Enter MTG</a></div></article>
<article class="card"><div><span class="tag">Simulation / proof</span><div class="mark">CINEMA</div><h3>DreamLedger Cinema</h3><p>Deterministic match generation with reproducible seeds, event streams and downloadable proof artifacts.</p></div><div><a class="btn primary" href="/cinema.html">Open Cinema</a></div></article>
<article class="card"><div><span class="tag">Digital products</span><div class="mark">DIGITAL</div><h3>Digital Products</h3><p>Deterministically fulfilled digital goods. The Commander diagnostic is one product inside this shelf rather than the identity of the whole storefront.</p></div><div><a class="btn primary" href="/digital-products.html">Open shelf</a></div></article>
<article class="card"><div><span class="tag">Identity / account</span><div class="mark">AVATAR</div><h3>DreamMee Avatar</h3><p>Persistent avatar and account identity surface. Separate from the commercial catalogue and available through its own doorway.</p></div><div><a class="btn primary" href="/avatar.html">Open avatar</a></div></article>
</div></section>
<section class="section"><div class="kicker">Proof status</div><h2>What is actually wired</h2><div class="proof"><article><strong>MTG CUBE</strong><span>Manifest, isolation and automated checkout route are CI-tested.</span></article><article><strong>CINEMA</strong><span>Deterministic fixture engine exposes reproducible event and proof output.</span></article><article><strong>FULFILLMENT</strong><span>Digital product surface is separate from the MTG silo and supports automated fulfillment.</span></article></div></section>
</main>
<footer class="footer">DreamLedger. Evidence first. Silos stay isolated. Product surfaces stay visible.</footer>
</div>
</body>
</html>`;

fs.writeFileSync(INDEX, html + '\n', 'utf8');
console.log(JSON.stringify({status:'PASS',file:INDEX,mode:'catalogue'},null,2));
