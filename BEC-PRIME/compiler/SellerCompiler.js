'use strict';

// Seller surfaces are projections of catalog/sellers/*.json. No manual HTML is authoritative.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SELLERS = path.join(ROOT, 'catalog', 'sellers');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const OUT = path.join(ROOT, 'compiled', 'website', 'sellers');
const PROOF = path.join(ROOT, 'PROOF-SELLER-SURFACES-COMPILATION.json');
function files(dir){return fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(x=>path.join(dir,x)):[];}
function read(f){return JSON.parse(fs.readFileSync(f,'utf8'));}
function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function digest(v){return crypto.createHash('sha256').update(v).digest('hex');}
const sellers=files(SELLERS).map(read).filter(s=>s.status!=='suspended');
const products=files(PRODUCTS).map(read).filter(p=>p.status==='published'&&p.commercial_truth&&p.commercial_truth.approval_required===false&&Number(p.inventory||0)>0);
const outputs=[];
for(const seller of sellers){
  if(!/^[a-z0-9-]{2,64}$/.test(String(seller.slug||''))) throw new Error('Invalid seller slug: '+seller.slug);
  const owned=products.filter(p=>String(p.seller_id||p.seller_slug||'')===String(seller.id||seller.slug));
  const cards=owned.map(p=>`<article><small>${esc(p.silo||'commerce')}</small><h2>${esc(p.name)}</h2><p>${esc(p.description||'')}</p><strong>${esc(p.currency||'NZD')} ${(Number(p.price||0)/100).toFixed(2)}</strong><button data-offer="${esc(p.id)}">Buy now</button></article>`).join('');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(seller.name||seller.slug)} | DreamLedger</title><style>body{margin:0;background:#070707;color:#f7f7f3;font-family:system-ui,sans-serif}.wrap{max-width:1200px;margin:auto;padding:28px}.gold,small{color:#f2c14e}.grid{display:flex;gap:14px;overflow-x:auto}article{flex:0 0 300px;border:1px solid #292929;border-radius:16px;background:#111;padding:20px}p{color:#888;min-height:50px}button{width:100%;padding:12px;border:0;border-radius:10px;background:#f2c14e;font-weight:900}</style></head><body><main class="wrap"><a class="gold" href="/">DREAMLEDGER</a><h1>${esc(seller.name||seller.slug)}</h1><p>${esc(seller.description||'Independent seller on DreamLedger.')}</p><div class="grid">${cards||'<p>No approved products are currently published for this seller.</p>'}</div></main><script>document.querySelectorAll('[data-offer]').forEach(b=>b.onclick=async()=>{const r=await fetch('/api/offer-checkout/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offer_id:b.dataset.offer})});const j=await r.json();if(j.url)location.href=j.url;else alert(j.error||'Checkout unavailable')})</script></body></html>`;
  const dir=path.join(OUT,seller.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),html,'utf8');
  outputs.push({slug:seller.slug,product_count:owned.length,path:`compiled/website/sellers/${seller.slug}/index.html`});
}
const proof={type:'dreamledger-seller-surface-compilation',status:'PASS',compiler:'SellerCompiler',generated_at:new Date().toISOString(),seller_count:sellers.length,outputs,source_hash:digest(JSON.stringify({sellers,products}))};
fs.writeFileSync(PROOF,JSON.stringify(proof,null,2)+'\n','utf8');console.log(JSON.stringify(proof,null,2));
