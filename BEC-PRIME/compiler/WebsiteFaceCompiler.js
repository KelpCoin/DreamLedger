'use strict';
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
function sha256(s){return crypto.createHash('sha256').update(s,'utf8').digest('hex');}
function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'));}
function write(f,t){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,t,'utf8');}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function loadRoutes(registry){
  const byId={};
  for(const r of registry.live_checkout_routes||[]) byId[r.id]=r;
  try{if(fs.existsSync(APPROVED)){const approved=readJson(APPROVED);
    for(const o of approved.approved||[]){const link=o.payment_link_url||o.payment_link;if(!link)continue;
      const id='APPROVED-'+(o.product_id||o.offer_id);if(byId[id])continue;
      byId[id]={id,name:o.name,price_nzd:Number(o.price),href:link,tag:o.silo||'approved'};}}}
  catch(_){}
  return byId;
}
function sortedRoutes(registry,routesById){
  return (registry.live_checkout_routes||[]).map(r=>routesById[r.id]).filter(Boolean)
    .sort((a,b)=>Number(a.price_nzd)-Number(b.price_nzd));
}
function navHtml(registry){
  return `<header class="top"><a class="brand" href="/">Dream<span>Ledger</span></a><nav>${(registry.nav||[]).map(n=>`<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('')}</nav></header>`;
}
function css(){return `:root{--bg:#0a0b0f;--surface:#141722;--ink:#f4f1ea;--muted:#9aa0b0;--line:#2a3040;--gold:#d8b56b;--goldb:#e8c87a}*{box-sizing:border-box;margin:0;padding:0}body{font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh}a{color:var(--goldb);text-decoration:none;font-weight:700}.wrap{max-width:960px;margin:auto;padding:24px 16px 80px}.top{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--line);margin-bottom:28px;gap:12px;flex-wrap:wrap}.brand span{color:var(--gold)}nav a{margin-left:12px;font-size:13px;color:var(--muted)}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:10px}h1{font-size:clamp(2rem,6vw,3rem);letter-spacing:-.04em;line-height:1.05;margin-bottom:12px}.lead{color:var(--muted);max-width:36em;margin-bottom:28px}.grid{display:grid;gap:14px}@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:8px}.card.hero{border-color:#d8b56b66;grid-column:1/-1}.tag{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}.price{font-size:1.6rem;font-weight:900}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 16px;border-radius:12px;background:linear-gradient(180deg,var(--goldb),var(--gold));color:#14120c;font-weight:900;border:0}.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}.actions{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.note{margin-top:28px;font-size:12px;color:var(--muted)}.badge{display:inline-block;font-size:10px;padding:4px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted);margin-bottom:12px}.banner{margin:0 0 20px;padding:14px 16px;border-radius:12px;border:1px solid #d8b56b44;background:#1a160c;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}.door p{color:var(--muted);font-size:13px;flex:1}`;}function shell({title,canonical,body}){return `<!doctype html>\n<html lang="en-NZ">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${esc(title)}</title>\n<meta name="description" content="Compiler-emitted DreamLedger face.">\n${canonical?`<link rel="canonical" href="${esc(canonical)}">`:''}\n<meta name="bec-compiler" content="WebsiteFaceCompiler">\n<style>\n${css()}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;}
function offerCard(route,hero){return `<article class="card${hero?' hero':''}"><div class="tag">${esc(route.tag||'Offer')}</div><h2>${esc(route.name)}</h2><div class="price">NZ$${esc(route.price_nzd)}</div><a class="btn" href="${esc(route.href)}">Pay on Stripe →</a></article>`;}
function emitMoney(face,registry,routesById){const cards=(face.primary_offer_ids||[]).map((id,i)=>{const r=routesById[id];return r?offerCard(r,i===0):'';}).join('\n');
  return shell({title:face.title,canonical:'https://dreamledger.org/money.html',body:`<div class="wrap">${navHtml(registry)}<span class="badge">emitted by WebsiteFaceCompiler · face=${esc(face.id)}</span><p class="eyebrow">${esc(face.eyebrow)}</p><h1>${esc(face.headline)}</h1><p class="lead">${esc(face.lead)}</p><div class="grid">${cards}</div><p class="note">Generated from face-registry.json.</p></div>`});}
function emitHome(face,registry,routesById){const primary=routesById[(face.primary_offer_ids||[])[0]];const secondary=(face.secondary_links||[]).map(l=>`<a class="btn ghost" href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  return shell({title:face.title,canonical:'https://dreamledger.org/',body:`<div class="wrap">${navHtml(registry)}<p class="eyebrow">${esc(face.eyebrow)}</p><h1>${esc(face.headline)}</h1><p class="lead">${esc(face.lead)}</p><div class="actions">${primary?`<a class="btn" href="${esc(primary.href)}">Compare supplier quotes · NZ${esc(primary.price_nzd)}</a>`:''}${secondary}</div><p class="note">DreamLedger is in trade in New Zealand. Paid services use Stripe-hosted checkout. A checkout is not described as delivered until fulfilment exists.</p></div>`});}
function emitShop(face,registry,routesById){const list=sortedRoutes(registry,routesById);const banner=routesById[face.banner_offer_id];const cards=list.map((r,i)=>offerCard(r,i===0)).join('\n');
  return shell({title:face.title,canonical:'https://dreamledger.org/shop.html',body:`<div class="wrap">${navHtml(registry)}<span class="badge">emitted by WebsiteFaceCompiler · face=${esc(face.id)}</span><p class="eyebrow">${esc(face.eyebrow)}</p><h1>${esc(face.headline)}</h1><p class="lead">${esc(face.lead)}</p>${banner?`<div class="banner"><div><strong>Fastest path:</strong> ${esc(banner.name)} · NZ$${esc(banner.price_nzd)}</div><a class="btn" href="${esc(banner.href)}">Pay NZ$${esc(banner.price_nzd)} →</a></div>`:''}<div class="grid">${cards}</div><p class="note">Sorted by price from registry.</p></div>`});}
function emitStart(face,registry){const doors=(face.doors||[]).map(d=>`<article class="card door"><h2>${esc(d.label)}</h2><p>${esc(d.blurb||'')}</p><a class="btn" href="${esc(d.href)}">Open →</a></article>`).join('\n');
  return shell({title:face.title,canonical:'https://dreamledger.org/start.html',body:`<div class="wrap">${navHtml(registry)}<span class="badge">emitted by WebsiteFaceCompiler · face=${esc(face.id)}</span><p class="eyebrow">${esc(face.eyebrow)}</p><h1>${esc(face.headline)}</h1><p class="lead">${esc(face.lead)}</p><div class="grid">${doors}</div><p class="note">Onboarding face.</p></div>`});}
function emitOffers(face,registry,routesById){const cards=sortedRoutes(registry,routesById).map(r=>offerCard(r,false)).join('\n');
  return shell({title:face.title,canonical:'https://dreamledger.org/offers.html',body:`<div class="wrap">${navHtml(registry)}<span class="badge">emitted by WebsiteFaceCompiler · face=${esc(face.id)}</span><p class="eyebrow">${esc(face.eyebrow)}</p><h1>${esc(face.headline)}</h1><p class="lead">${esc(face.lead)}</p><div class="grid">${cards}</div><p class="note">Structured offers only.</p></div>`});}
function compile(){const registry=readJson(REGISTRY);const routesById=loadRoutes(registry);const emitted=[];
  const emitters={money:emitMoney,home:emitHome,shop:emitShop,start:emitStart,offers:emitOffers};
  for(const face of registry.faces||[]){const fn=emitters[face.id];if(!fn)throw new Error('Unknown face: '+face.id);
    const html=fn(face,registry,routesById);write(path.join(COMPILED_OUT,face.out),html);write(path.join(PUBLIC_OUT,face.out),html);
    emitted.push({face:face.id,out:face.out,bytes:Buffer.byteLength(html,'utf8'),sha256:sha256(html)});}
  const redirect='<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/money.html"><title>Cash</title></head><body><a href="/money.html">Pay →</a></body></html>\n';
  write(path.join(COMPILED_OUT,'cash.html'),redirect);write(path.join(PUBLIC_OUT,'cash.html'),redirect);
  emitted.push({face:'cash_redirect',out:'cash.html',bytes:Buffer.byteLength(redirect),sha256:sha256(redirect)});
  const proof={schema:'dreamledger/website-face-compiler-proof/v1',status:'PASS',compiler:'WebsiteFaceCompiler',architecture:'website-as-exhaust',registry:'BEC-PRIME/compiler/face-registry.json',emitted_at:new Date().toISOString(),emitted,rule:'Re-run compiler; do not hand-edit emitted HTML'};
  write(PROOF,JSON.stringify(proof,null,2)+'\n');return proof;}
if(require.main===module)console.log(JSON.stringify(compile(),null,2));
module.exports={compile};
