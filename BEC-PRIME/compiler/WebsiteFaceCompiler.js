'use strict';

/**
 * WebsiteFaceCompiler — website as BECK exhaust
 *
 * Source of truth: face-registry.json + live_checkout_routes (+ approved offers when present).
 * Output: BEC-PRIME/compiled/website/*.html and public/*.html (storefront root).
 * Does not enable checkout; only links routes that already settle on Stripe.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const REGISTRY = path.join(__dirname, 'face-registry.json');
const COMPILED_OUT = path.join(ROOT, 'compiled', 'website');
const PUBLIC_OUT = path.join(REPO, 'public');
const PROOF = path.join(ROOT, 'RUN-PROOFS', 'WEBSITE-FACE-COMPILER-PROOF.json');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function loadRoutes(registry) {
  const byId = {};
  for (const r of registry.live_checkout_routes || []) byId[r.id] = r;
  // Merge approved offers that have payment links (optional enrichment)
  try {
    if (fs.existsSync(APPROVED)) {
      const approved = readJson(APPROVED);
      for (const o of approved.approved || []) {
        if (!o.payment_link_url && !o.payment_link) continue;
        const id = 'APPROVED-' + (o.product_id || o.offer_id);
        if (byId[id]) continue;
        byId[id] = {
          id,
          name: o.name,
          price_nzd: Number(o.price),
          href: o.payment_link_url || o.payment_link,
          tag: o.silo || 'approved',
          from_approved: true
        };
      }
    }
  } catch (_) {}
  return byId;
}

function shell({ title, body, canonical }) {
  return `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Compiler-emitted DreamLedger face. Structured offers only.">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta name="bec-compiler" content="WebsiteFaceCompiler">
<style>
:root{--bg:#0a0b0f;--surface:#141722;--ink:#f4f1ea;--muted:#9aa0b0;--line:#2a3040;--gold:#d8b56b;--goldb:#e8c87a;--mint:#a9f2d0}
*{box-sizing:border-box;margin:0;padding:0}body{font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh}
a{color:var(--goldb);text-decoration:none;font-weight:700}
.wrap{max-width:960px;margin:auto;padding:24px 16px 80px}
.top{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--line);margin-bottom:28px;gap:12px;flex-wrap:wrap}
.brand span{color:var(--gold)}
nav a{margin-left:12px;font-size:13px;color:var(--muted)}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:10px}
h1{font-size:clamp(2rem,6vw,3rem);letter-spacing:-.04em;line-height:1.05;margin-bottom:12px}
.lead{color:var(--muted);max-width:36em;margin-bottom:28px}
.grid{display:grid;gap:14px}@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:8px}
.card.hero{border-color:#d8b56b66;grid-column:1/-1}
.tag{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.price{font-size:1.6rem;font-weight:900}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 16px;border-radius:12px;background:linear-gradient(180deg,var(--goldb),var(--gold));color:#14120c;font-weight:900;border:0}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}
.note{margin-top:28px;font-size:12px;color:var(--muted)}
.badge{display:inline-block;font-size:10px;padding:4px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted);margin-bottom:12px}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function renderOfferCard(route, hero) {
  return `<article class="card${hero ? ' hero' : ''}">
  <div class="tag">${esc(route.tag || 'Offer')}</div>
  <h2>${esc(route.name)}</h2>
  <div class="price">NZ$${esc(route.price_nzd)}</div>
  <a class="btn" href="${esc(route.href)}">Pay on Stripe →</a>
</article>`;
}

function emitMoney(face, routesById) {
  const ids = face.primary_offer_ids || [];
  const cards = ids
    .map((id, i) => {
      const r = routesById[id];
      if (!r) return '';
      return renderOfferCard(r, i === 0);
    })
    .join('\n');
  const body = `<div class="wrap">
<header class="top">
  <a class="brand" href="/">Dream<span>Ledger</span></a>
  <nav><a href="/shop.html">Shop</a><a href="/mtg/">Magic</a><a href="/avatar.html">Avatar</a></nav>
</header>
<span class="badge">emitted by WebsiteFaceCompiler · face=${esc(face.id)}</span>
<p class="eyebrow">${esc(face.eyebrow)}</p>
<h1>${esc(face.headline)}</h1>
<p class="lead">${esc(face.lead)}</p>
<div class="grid">${cards}</div>
<p class="note">Generated from <code>face-registry.json</code>. Checkout routes are live Stripe adapters — not compiler-invented payments.</p>
</div>`;
  return shell({
    title: face.title,
    canonical: 'https://dreamledger.org/money.html',
    body
  });
}

function emitHome(face, routesById) {
  const primary = routesById[(face.primary_offer_ids || [])[0]];
  const secondary = (face.secondary_links || [])
    .map((l) => `<a class="btn ghost" href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('');
  const body = `<div class="wrap">
<header class="top">
  <a class="brand" href="/">Dream<span>Ledger</span></a>
  <nav><a href="/money.html">Pay</a><a href="/shop.html">Shop</a><a href="/mtg/">Magic</a></nav>
</header>
<span class="badge">emitted by WebsiteFaceCompiler · face=${esc(face.id)}</span>
<p class="eyebrow">${esc(face.eyebrow)}</p>
<h1>${esc(face.headline)}</h1>
<p class="lead">${esc(face.lead)}</p>
<div class="actions">
  ${primary ? `<a class="btn" href="${esc(primary.href)}">Pay NZ$${esc(primary.price_nzd)} on Stripe →</a>` : ''}
  ${secondary}
</div>
<p class="note">This face is compiler exhaust. Economic truth requires a settled receipt.</p>
</div>`;
  return shell({
    title: face.title,
    canonical: 'https://dreamledger.org/',
    body
  });
}

function compile() {
  const registry = readJson(REGISTRY);
  const routesById = loadRoutes(registry);
  const emitted = [];

  for (const face of registry.faces || []) {
    let html;
    if (face.id === 'money') html = emitMoney(face, routesById);
    else if (face.id === 'home') html = emitHome(face, routesById);
    else throw new Error('Unknown face emitter: ' + face.id);

    const rel = face.out;
    write(path.join(COMPILED_OUT, rel), html);
    write(path.join(PUBLIC_OUT, rel), html);
    emitted.push({
      face: face.id,
      out: rel,
      bytes: Buffer.byteLength(html, 'utf8'),
      sha256: sha256(html)
    });
  }

  // cash.html → money.html redirect (also exhaust)
  const redirect = `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/money.html"><title>Cash</title></head><body><a href="/money.html">Pay →</a></body></html>\n`;
  write(path.join(COMPILED_OUT, 'cash.html'), redirect);
  write(path.join(PUBLIC_OUT, 'cash.html'), redirect);
  emitted.push({ face: 'cash_redirect', out: 'cash.html', bytes: Buffer.byteLength(redirect), sha256: sha256(redirect) });

  const proof = {
    schema: 'dreamledger/website-face-compiler-proof/v1',
    status: 'PASS',
    compiler: 'WebsiteFaceCompiler',
    architecture: 'website-as-exhaust',
    registry: 'BEC-PRIME/compiler/face-registry.json',
    emitted_at: new Date().toISOString(),
    emitted,
    rule: 'No hand-maintained money/home faces; re-run compiler to change CTAs'
  };
  write(PROOF, JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (require.main === module) {
  console.log(JSON.stringify(compile(), null, 2));
}

module.exports = { compile };
