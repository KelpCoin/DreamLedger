'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const input = path.join(root, 'data', '777', '777-LATEST.json');
const output = path.join(root, '..', 'economic-pulse.html');

if (!fs.existsSync(input)) {
  throw new Error('777-LATEST.json not found. Compounding Artifact requires a completed 777 search artifact.');
}

const x = JSON.parse(fs.readFileSync(input, 'utf8'));
const truth = x.truth || {};
const allocation = Array.isArray(x.golden_allocation) ? x.golden_allocation.slice(0, 2) : [];
const evergreen = x.evergreen_expansion || {};
const generated = x.generated_at_utc || 'unknown';
const seedCount = Number(x.seed_count || 0);
const candidateCount = Number(x.candidate_count || 0);
const buyerSignalCount = Number(x.buyer_signal_count || 0);

const esc = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cards = allocation.map((a, i) => {
  const g = a.golden || {};
  return '<article class="card"><span class="num">ATTENTION ' + (i + 1) +
    '</span><h2>' + esc(a.title || a.seed_opportunity_id || 'Unlabelled substrate') +
    '</h2><p>Internal allocation score: <strong>' + esc(g.score ?? 'n/a') +
    '</strong>. This is an attention score, not economic truth, authorization, or revenue.</p></article>';
}).join('');

const status = evergreen.status || 'UNKNOWN';
const variants = Number(evergreen.batch_size || 0);

const html = '<!doctype html>\\n<html lang="en-NZ"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<meta name="robots" content="index,follow">' +
'<meta name="description" content="DreamLedger Compounding Artifact: the public, evidence-gated economic observatory.">' +
'<link rel="canonical" href="https://dreamledger.org/economic-pulse.html">' +
'<title>DreamLedger | Compounding Artifact</title>' +
'<style>:root{color-scheme:dark;--bg:#07090d;--panel:#10151c;--line:#29333e;--text:#f5f7fa;--muted:#99a5b3;--accent:#b9f6d1;--gold:#f0d37c}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#17251f,transparent 35%),var(--bg);color:var(--text);font:16px/1.55 Inter,system-ui,sans-serif}.wrap{width:min(calc(100% - 36px),980px);margin:auto}header{padding:28px 0;border-bottom:1px solid var(--line)}a{color:var(--accent)}main{padding:58px 0}.eyebrow,.num{color:var(--gold);font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(42px,7vw,72px);line-height:.98;letter-spacing:-.06em;margin:14px 0}.lede{max-width:720px;color:var(--muted);font-size:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:35px 0}.metric,.card{border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:20px}.metric strong{display:block;font-size:26px;margin-bottom:4px}.metric span,.card p{color:var(--muted);font-size:13px}.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:18px}.truth{margin-top:30px;border:1px solid #5a4930;border-radius:16px;padding:20px;background:#141109}.truth strong{color:var(--gold)}footer{margin-top:55px;padding:25px 0;border-top:1px solid var(--line);color:var(--muted);font-size:12px}@media(max-width:720px){.grid,.cards{grid-template-columns:1fr 1fr}.metric strong{font-size:21px}}@media(max-width:520px){.grid,.cards{grid-template-columns:1fr}}</style>' +
'</head><body><header><div class="wrap"><a href="/">DreamLedger</a></div></header><main><div class="wrap">' +
'<div class="eyebrow">Compounding Artifact · 777 Economic Observatory</div>' +
'<h1>What the machine knows now.</h1>' +
'<p class="lede">This page is generated from the completed 777 search artifact. Each cycle adds durable evidence, lineage, candidate structure and telemetry without converting model output into economic truth.</p>' +
'<div class="grid">' +
'<div class="metric"><strong>' + seedCount + '</strong><span>economic seeds searched</span></div>' +
'<div class="metric"><strong>' + candidateCount + '</strong><span>bounded hypotheses generated</span></div>' +
'<div class="metric"><strong>' + buyerSignalCount + '</strong><span>buyer signals observed</span></div>' +
'<div class="metric"><strong>' + variants + '</strong><span>CUBE probe variants prepared</span></div>' +
'</div>' +
'<h2>Current internal attention</h2><div class="cards">' + cards +
'</div><div class="truth"><strong>Economic truth boundary</strong><p>Verified external revenue: NZ$' +
esc(Number(truth.verified_external_revenue_nzd || 0).toFixed(2)) +
'. Settled external payments: ' + esc(truth.settled_external_payments || 0) +
'. Independent external buyers: ' + esc(truth.independent_external_buyers || 0) +
'. Verified outcomes: ' + esc(truth.verified_economic_outcomes || 0) +
'. These values remain zero unless independently observed and reconciled.</p></div>' +
'<h2>Evergreen</h2><p class="lede">Current state: <strong>' + esc(status) +
'</strong>. Evergreen replication remains forbidden until an economic mechanism is independently verified. Internal probing is not replication.</p>' +
'<p class="note">777 artifact generated: ' + esc(generated) + '</p>' +
'<footer>Compounding Artifact. Failed mechanisms die small. Verified mechanisms may grow.</footer>' +
'</div></main></body></html>\\n';

fs.writeFileSync(output, html, 'utf8');
console.log(JSON.stringify({ok:true, output, generated, seedCount, candidateCount, buyerSignalCount, variants, evergreenStatus:status}));
