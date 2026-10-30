'use strict';
// CUBE private preview renderer. No network or checkout.
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function demand(ok,why){if(!ok)throw Error('CUBE_PREVIEW_HOLD: '+why);}
function renderStorefront(o){
  demand(o&&o.manifest&&o.catalogue&&o.seedReview&&o.health,'compiled candidate required');
  const m=o.manifest,c=o.catalogue,s=o.seedReview,h=o.health;
  demand(m.schema==='CUBE/SILO/v2'&&m.state==='draft'&&m.checkout_enabled===false&&m.public_approved===false,'not a private draft');
  demand(c.silo_id===m.slug&&s.silo_id===m.slug&&h.silo_id===m.slug,'cross-silo mismatch');
  demand(c.checkout_enabled===false&&Array.isArray(c.products)&&c.products.length===0,'catalogue stock must be empty');
  demand(s.public===false&&Array.isArray(s.candidates)&&h.status==='HOLD_NOT_READY','unverified readiness');
  demand(/^#[0-9a-f]{6}$/i.test(m.brand.accent),'invalid brand accent');
  let cards=s.candidates.map(x=>{
    demand(x.status==='pending_review'&&x.checkout_available===false&&x.quantity_available===0&&x.supply_attestation_verified===false,'unverified candidate');
    return `<article class="card" data-title="${esc(x.title.toLowerCase())}"><p class="eyebrow">UNDER REVIEW</p><h3>${esc(x.title)}</h3><p>Candidate SKU: <code>${esc(x.sku)}</code></p><p>Stock, price and delivery are not verified.</p><span class="pill">Checkout unavailable</span></article>`;
  }).join('\n');
  if(!cards)cards='<div class="empty"><h3>No approved products yet</h3><p>This private storefront has no verified stock or offers.</p></div>';
  const input=s.candidates.length?'<label for="query">Search candidate listings</label><input type="search" id="query" autocomplete="off" aria-controls="cards" placeholder="Search titles"><p id="count" role="status" aria-live="polite"></p>':'';
  return `<!doctype html>
<html lang="${esc(m.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<title>${esc(m.display_name)} | CUBE private preview</title>
<style>
:root{color-scheme:dark;--accent:${m.brand.accent};--bg:#080f18;--ink:#f0f4f8;--muted:#b9cad6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif}
header,main,footer{max-width:1100px;margin:auto;padding:22px}header{border-bottom:1px solid #405064;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{font-weight:800}.pill{display:inline-block;border:1px solid #a18b58;padding:6px 10px;border-radius:8px;color:#f5dba2;font-size:12px}
h1{font-size:clamp(32px,6vw,60px);line-height:1.1;letter-spacing:-.03em}h2{font-size:24px}
.lead{max-width:670px;color:var(--muted);font-size:19px}.panel{margin:26px 0;padding:22px;border:1px solid #35485b;border-radius:16px;background:#152230}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.card{padding:20px;border:1px solid #415367;border-radius:12px;background:#0d1a28}.card[hidden]{display:none}
.eyebrow{color:#f5dba2;font-size:12px;letter-spacing:.12em;font-weight:700}
.card h3{margin:7px 0}.card p{overflow-wrap:anywhere}.empty{padding:16px;color:var(--muted)}
label{font-weight:700;display:block;margin:0 0 6px}input{display:block;background:#0b1724;color:var(--ink);border:1px solid #a1b5c2;border-radius:9px;padding:12px;font:inherit;width:100%;max-width:500px}
footer{border-top:1px solid #405064;color:var(--muted);font-size:13px}a{color:var(--accent)}
@media(max-width:520px){header{align-items:flex-start;flex-direction:column}}
</style></head>
<body data-silo="${esc(m.slug)}">
<header><span class="brand">${esc(m.brand.name)}</span><span class="pill">PRIVATE PREVIEW / CHECKOUT OFF</span></header>
<main><section><p class="eyebrow">CUBE Master Silo</p><h1>${esc(m.display_name)}</h1>
<p class="lead">A reusable niche storefront preview. No items are offered for sale until independently verified and approved.</p></section>
<section class="panel"><h2>Catalogue preview</h2><p>${s.candidates.length} unverified candidates. Sellable products: 0.</p>
${input}<div class="grid" id="cards">${cards}</div></section>
<section class="panel"><h2>Launch requirements</h2><p>Supply verification, jurisdiction rules, isolated accounts, payment settlement, delivery and explicit publication approval are required before checkout can open.</p></section>
</main><footer>Offline CUBE preview. Not a live store. <a href="/">DreamLedger homepage</a></footer>
<script>(function(){var q=document.getElementById('query');if(!q)return;var cards=[].slice.call(document.querySelectorAll('[data-title]'));var count=document.getElementById('count');function update(){var needle=q.value.toLowerCase().trim(),n=0;cards.forEach(function(c){var ok=c.getAttribute('data-title').indexOf(needle)>=0;c.hidden=!ok;if(ok)n++;});count.textContent=n+' of '+cards.length+' candidates visible';}q.addEventListener('input',update);update();})();</script>
</body></html>
`;
}
module.exports={esc,renderStorefront};
