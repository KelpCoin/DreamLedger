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
<meta name="description" content="DreamLedger Commander Deck Diagnostic for Magic: The Gathering Commander players.">
<meta name="theme-color" content="#090b0f">
<title>DreamLedger | Commander Deck Diagnostic</title>
<style>
:root{--bg:#090b0f;--panel:#11151b;--line:#29313a;--ink:#f5f3eb;--muted:#9da7b1;--gold:#d8b56b;--max:980px}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#252015 0,#090b0f 34%);color:var(--ink);font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:var(--max);margin:auto;padding:0 18px 70px}.nav{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:20px 0;border-bottom:1px solid var(--line)}.brand{font-weight:950;letter-spacing:.08em;color:var(--ink);text-decoration:none}.brand b{color:var(--gold)}.navlinks{display:flex;gap:12px;flex-wrap:wrap}.navlinks a{color:var(--muted);text-decoration:none}.hero{padding:70px 0 42px}.kicker{font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}h1{font-size:clamp(48px,9vw,96px);line-height:.88;letter-spacing:-.065em;margin:12px 0 20px;max-width:900px}.hero p{max-width:760px;color:var(--muted);font-size:19px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.btn{display:inline-block;padding:13px 17px;border-radius:10px;text-decoration:none;font-weight:900;border:1px solid var(--line);color:var(--ink)}.btn.primary{background:var(--gold);color:#111;border-color:var(--gold)}.card{background:linear-gradient(180deg,#151b22,#0e1217);border:1px solid var(--line);border-radius:20px;padding:24px;margin-top:18px}.price{font-size:36px;font-weight:950;color:var(--gold)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.grid article{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px}.grid strong{display:block;font-size:18px}.grid span{display:block;color:var(--muted);font-size:13px;margin-top:6px}.footer{margin-top:54px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}.nav{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
<header class="nav"><a class="brand" href="/">DREAM<b>LEDGER</b></a><nav class="navlinks"><a href="/mtg">Commander decks</a><a href="/mtg/diagnostic.html">Diagnostic</a></nav></header>
<main>
<section class="hero"><div class="kicker">Magic: The Gathering / Commander</div><h1>Commander Deck Diagnostic.</h1><p>Get a focused automated review of your Commander deck: structural issues, weak-card candidates, upgrade priorities and a practical tuning path.</p><div class="actions"><a class="btn primary" href="/mtg/diagnostic.html">Start the diagnostic - NZ$29</a><a class="btn" href="/mtg">Browse Commander decks</a></div></section>
<section class="card"><div class="price">NZ$29</div><p>Submit your Commander decklist, complete checkout, and receive the automated diagnostic after verified payment.</p><div class="grid"><article><strong>STRUCTURE</strong><span>Identify structural weaknesses in the submitted decklist.</span></article><article><strong>UPGRADES</strong><span>Prioritize practical improvements instead of dumping a card list on you.</span></article><article><strong>TUNING PLAN</strong><span>Receive a focused next-step plan for improving the deck.</span></article></div><div class="actions"><a class="btn primary" href="/mtg/diagnostic.html">Start the diagnostic</a></div></section>
<section class="card"><div class="kicker">Commercial truth</div><h2>One product. One price. One MTG surface.</h2><p>DreamLedger has not represented this diagnostic as previously validated. This page is the customer-facing offer for the initial real-customer validation experiment.</p></section>
</main>
<footer class="footer">DreamLedger. Commander diagnostic surface. Evidence first. Public consequential actions remain approval-gated.</footer>
</div>
</body>
</html>`;

fs.writeFileSync(INDEX, html + '\n', 'utf8');
console.log(JSON.stringify({status:'PASS',file:INDEX,mode:'mtg-isolated-front-door'},null,2));
