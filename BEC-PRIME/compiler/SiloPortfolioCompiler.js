'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'PROOF-2026-08-11-MONETIZATION-WEDGE-PORTFOLIO.json');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'portfolio');
const CATALOG_DIR = path.join(ROOT, 'catalog', 'compiled');
const CATALOG = path.join(CATALOG_DIR, 'silo-portfolio.json');
const PROOF = path.join(ROOT, 'PROOF-SILO-PORTFOLIO-COMPILATION.json');

function must(file) {
  if (!fs.existsSync(file)) throw new Error(`Silo portfolio input missing: ${path.relative(ROOT, file)}`);
}
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
}
function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function digest(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}
function readJson(file) {
  must(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const source = readJson(SOURCE);
const wedges = Array.isArray(source.ranked_wedges) ? source.ranked_wedges : [];
if (!wedges.length) throw new Error('No monetization wedges found. Refusing to compile an empty sales surface.');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(CATALOG_DIR, { recursive: true });

const compiled = wedges.map((wedge, index) => {
  const id = `WEDGE-${String(wedge.rank || index + 1).padStart(2, '0')}-${slug(wedge.name).toUpperCase()}`;
  const route = `/portfolio/${slug(wedge.name)}.html`;
  return {
    id,
    rank: Number(wedge.rank || index + 1),
    name: wedge.name,
    priority: wedge.priority || 'P2',
    buyer: wedge.buyer || 'Qualified operator',
    monetization: wedge.monetization || 'Quote after discovery',
    wedge: wedge.wedge || '',
    route,
    activation_state: 'APPROVAL_GATED',
    checkout_available: false,
    payment_claimed: false,
    source: 'BEC-PRIME/PROOF-2026-08-11-MONETIZATION-WEDGE-PORTFOLIO.json',
    cta: {
      label: 'Request this wedge',
      action: 'proposal_only',
      target: route
    },
    tunnel: {
      entry: route,
      next: 'proposal',
      then: 'human_review',
      then_after_approval: 'canonical_offer'
    },
    sku_family: [
      'SERVICE_PAGE',
      'DIAGNOSTIC',
      'IMPLEMENTATION',
      'RECURRING_OPERATION',
      'BILLBOARD'
    ]
  };
});

const catalog = {
  schema: 'BEC-PRIME/SILO-PORTFOLIO/v1',
  status: 'COMPILED',
  compiler: 'SiloPortfolioCompiler',
  compiled_at: new Date().toISOString(),
  source_hash: digest(fs.readFileSync(SOURCE, 'utf8')),
  activation_policy: {
    approval_required: true,
    checkout_available: false,
    public_ip_doctrine_exposed: false,
    private_material_excluded: true,
    payment_claims_allowed: false,
    external_actions_allowed: false
  },
  wedge_count: compiled.length,
  wedges: compiled
};
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

function page(wedge) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<title>${esc(wedge.name)} | DreamLedger</title>
<style>
:root{--bg:#090a0d;--panel:#151820;--line:#303541;--text:#f4f1eb;--muted:#a8adb8;--gold:#d8b66b;--pink:#e5a6c4}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 70% -10%,#241a26,#090a0d 48%);color:var(--text);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:900px;margin:auto;padding:28px 20px 60px}.eyebrow{color:var(--pink);font-size:.72rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(2.5rem,7vw,5.4rem);line-height:.92;letter-spacing:-.055em;margin:12px 0 18px}p{color:var(--muted);max-width:720px}.panel{border:1px solid var(--line);background:rgba(21,24,32,.88);border-radius:18px;padding:22px;margin:18px 0}.label{font-size:.7rem;color:var(--gold);font-weight:900;letter-spacing:.12em;text-transform:uppercase}.cta{display:inline-block;margin-top:10px;padding:13px 18px;border-radius:11px;background:var(--gold);color:#111;text-decoration:none;font-weight:900}.back{color:var(--muted);text-decoration:none}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:680px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body><main class="wrap">
<a class="back" href="/portfolio/">&larr; Back to portfolio</a>
<div class="eyebrow">DreamLedger / compiled wedge ${String(wedge.rank).padStart(2,'0')}</div>
<h1>${esc(wedge.name)}</h1>
<p>${esc(wedge.wedge)}</p>
<div class="grid">
<section class="panel"><div class="label">Buyer</div><p>${esc(wedge.buyer)}</p></section>
<section class="panel"><div class="label">Monetization</div><p>${esc(wedge.monetization)}</p></section>
</div>
<section class="panel"><div class="label">Compiled tunnel</div><p>CTA &rarr; proposal &rarr; human review &rarr; canonical offer &rarr; activation only after approval. No checkout is implied by this page.</p><a class="cta" href="mailto:hello@dreamledger.org?subject=${encodeURIComponent('DreamLedger: '+wedge.name)}">Request this wedge</a></section>
<section class="panel"><div class="label">Billboard SKU</div><p>This surface is a billboard SKU: it is an indexed entry point into the service tunnel, not a claim that the service has already been sold or activated.</p></section>
</main></body></html>`;
}

for (const wedge of compiled) {
  fs.writeFileSync(path.join(OUT_DIR, `${slug(wedge.name)}.html`), page(wedge), 'utf8');
}

const indexCards = compiled.map(wedge => `<article class="card"><div class="rank">#${wedge.rank} / ${esc(wedge.priority)}</div><h2>${esc(wedge.name)}</h2><p>${esc(wedge.wedge)}</p><div class="buyer">${esc(wedge.buyer)}</div><a href="${wedge.route}">Open service tunnel &rarr;</a></article>`).join('\n');
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="DreamLedger compiled monetization portfolio. Each card is a proposal-only service tunnel until human approval."><title>DreamLedger | Monetization Portfolio</title><style>:root{--bg:#090a0d;--panel:#151820;--line:#303541;--text:#f4f1eb;--muted:#a8adb8;--gold:#d8b66b;--pink:#e5a6c4}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 70% -10%,#241a26,#090a0d 48%);color:var(--text);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1200px;margin:auto;padding:32px 20px 60px}.eyebrow{color:var(--pink);font-size:.72rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase}h1{font-size:clamp(3rem,8vw,7rem);line-height:.86;letter-spacing:-.06em;margin:12px 0 20px}.lead{color:var(--muted);max-width:760px}.rail{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:28px}.card{border:1px solid var(--line);background:rgba(21,24,32,.9);border-radius:18px;padding:20px}.rank{color:var(--gold);font-size:.68rem;font-weight:900;letter-spacing:.12em}.card h2{margin:8px 0;font-size:1.35rem}.card p{color:var(--muted);min-height:72px}.buyer{color:#d2d5db;font-size:.88rem;min-height:48px}.card a{display:inline-block;margin-top:15px;color:#111;background:var(--gold);padding:11px 14px;border-radius:10px;text-decoration:none;font-weight:900}.notice{margin-top:24px;border:1px solid var(--line);border-radius:14px;padding:16px;color:var(--muted)}@media(max-width:760px){.rail{grid-template-columns:1fr}}</style></head><body><main class="wrap"><div class="eyebrow">DreamLedger / CUBE / compiled commerce portfolio</div><h1>More doors. One compiler.</h1><p class="lead">${compiled.length} monetization wedges compiled from the canonical portfolio. Each card is a service-page entry point and billboard SKU leading into a proposal tunnel. Nothing here silently unlocks payment, publication, or external action.</p><section class="rail">${indexCards}</section><div class="notice">Activation remains approval-gated. The compiler may create surfaces and proposals, but it does not claim a sale, unlock checkout, expose private IP doctrine, or execute an external action.</div></main></body></html>`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), index, 'utf8');

const proof = {
  schema: 'BEC-PRIME/SILO-PORTFOLIO-COMPILATION/v1',
  status: 'PASS',
  compiled_at: catalog.compiled_at,
  source_hash: catalog.source_hash,
  wedge_count: compiled.length,
  generated: {
    catalog: path.relative(ROOT, CATALOG),
    index: path.relative(ROOT, path.join(OUT_DIR, 'index.html')),
    service_pages: compiled.map(w => path.relative(ROOT, path.join(OUT_DIR, `${slug(w.name)}.html`)))
  },
  guarantees: {
    approval_required: true,
    checkout_available: false,
    payment_claimed: false,
    private_ip_exposed: false,
    silo_isolation_required: true,
    external_actions_allowed: false
  }
};
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
