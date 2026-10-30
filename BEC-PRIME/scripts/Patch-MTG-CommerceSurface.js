'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';

function writeProof(status = 'PASS') {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v2',
    status,
    legacy_render_patch_applied: status === 'PASS',
    // Modern template has a separate detail-page flow; this patch cannot
    // certify its checkout or stock truth just because the HTML exists.
    checkout_verified: false,
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_endpoint: '/api/products',
    checkout_endpoint: '/api/offer-checkout/create',
    horizontal_catalogue: true,
    displays: ['image', 'name', 'price_nzd', 'availability', 'buy_button', 'condition_for_verified_singles_only'],
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

// Recognize the current NZ deck-grid implementation, but only when it
// explicitly cross-checks inventory and keeps checkout held. This is NOT an
// authorization to publish/sell or a fallback for unknown templates.
function isKnownHeldModernDeckGrid(html) {
  const required = [
    'id="grid"',
    "const CATALOG='/data/mtg-catalog.json'",
    "const decks=data.products.filter(p=>p&&p.status==='published'&&isPhysical(p));",
    "Boolean(p.checkout_available)===Boolean(m.checkout_available)",
    "if(!r.ok||!g.ok)throw new Error('Catalogue unavailable; purchases held')",
    'Checkout held until independent reservation and fulfilment proof.'
  ];
  const forbidden = [
    'buy.stripe.com',
    "fetch('/api/offer-checkout/create'",
    'window.location.assign(data.checkout_url)'
  ];
  return required.every(x => html.includes(x)) &&
    forbidden.every(x => !html.includes(x));
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  if (html.includes(MARKER)) {
    writeProof();
    return;
  }
  const original = html;

  html = html.replace(
    '.rail{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:10px 0 18px}',
    '.rail{display:flex;gap:14px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding:10px 2px 22px;scrollbar-width:thin}.rail .card{flex:0 0 min(330px,82vw);scroll-snap-align:start}.art{position:relative}.art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92}'
  );

  const start = html.indexOf('function render(items){');
  const end = html.indexOf('async function load(){', start);
  if (start < 0 || end < 0) {
    // The modern deck-grid template replaced the old render(items) DOM and
    // embeds no such function. DO NOT splice the legacy renderer into it.
    // Safely skip an obsolete MTG-only presentation patch without blocking
    // the niche-agnostic commerce compiler for other silos.
    if (isKnownHeldModernDeckGrid(html)) {
      console.log('MTG_LEGACY_PATCH_SKIPPED_MODERN_TEMPLATE');
      writeProof('SKIPPED_MODERN_TEMPLATE_CHECKOUT_UNVERIFIED');
      return;
    }
    throw new Error('MTG render function boundary not found; unknown template remains BLOCKED');
  }

  const render = String.raw`function render(items){
const decks=items.filter(isMtg);
const live=decks.filter(p=>String(p.status).toLowerCase()==='published');
const units=decks.reduce((n,p)=>n+(Number(p.inventory)||0),0);
count.textContent=decks.length;
published.textContent=live.length;
stock.textContent=units;
status.textContent=decks.length?'Discovered MTG records: '+decks.length:'No MTG records discovered.';
rail.innerHTML=decks.map((p,i)=>{
  const purchasable=String(p.status).toLowerCase()==='published'&&(Number(p.inventory)||0)>0;
  const legacyMinor=String(p.id||'')==='MTG-URZAS-LEGACY-PALINCHRON-FOIL-001';
  const priceMajor=(String(p.price_unit||'').toLowerCase()==='minor'||String(p.price_unit||'').toLowerCase()==='cents'||legacyMinor)?Number(p.price)/100:Number(p.price);
  const image=p.image_url||p.imageUrl||p.image||'';
  const kind=String(p.product_kind||p.category||p.inventory_type||'').toLowerCase();
  const conditionEligible=['single','single-card','mtg-single','physical-single'].includes(kind);
  const condition=conditionEligible&&typeof p.condition==='string'&&p.condition.trim()?p.condition.trim():'';
  return '<article class="card"><div class="art">'+(image?'<img src="'+esc(image)+'" alt="'+esc(p.name||p.id)+'">':'')+'<div class="sigil">'+(i%3===0?'MTG':'EDH')+'</div></div><div class="body"><span class="pill">'+esc(p.id||'MTG')+'</span><h2>'+esc(p.name||p.id)+'</h2><div class="desc">'+esc(p.description||'MTG inventory item.')+'</div><div class="row"><span>'+esc(condition)+'</span><span>$'+priceMajor.toFixed(2)+' NZD</span></div><div class="row"><span class="'+(purchasable?'ok':'wait')+'">'+(purchasable?'IN STOCK':'NOT CURRENTLY PURCHASABLE')+'</span><span>'+esc(p.inventory==null?'?':p.inventory)+' units</span></div><button class="buy mtg-buy" '+(purchasable?'':'disabled')+' data-id="'+esc(p.id||'')+'">'+(purchasable?'BUY NOW':'UNAVAILABLE')+'</button></div></article>';
}).join('');
a.innerHTML=decks.map(p=>'<option value="'+esc(p.id||'')+'">'+esc(p.name||p.id)+'</option>').join('');
b.innerHTML=a.innerHTML;
if(decks.length>1)b.selectedIndex=1;
rail.querySelectorAll('.mtg-buy').forEach(button=>button.addEventListener('click',async()=>{
  const id=button.getAttribute('data-id');
  if(!id)return;
  const old=button.textContent;
  button.disabled=true;
  button.textContent='OPENING CHECKOUT...';
  try{
    const r=await fetch('/api/offer-checkout/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer_id:id})});
    const data=await r.json();
    if(!r.ok||!data.checkout_url)throw new Error(data.error||'Checkout unavailable');
    window.location.assign(data.checkout_url);
  }catch(err){
    button.disabled=false;
    button.textContent=old;
    status.className='status error';
    status.textContent='Checkout error: '+err.message;
  }
}));
}`;

  html = html.slice(0, start) + render + html.slice(end);
  html = html.replace('<body>', '<body '+MARKER+'>');

  if (html === original) throw new Error('MTG commerce patch made no changes');
  fs.writeFileSync(SOURCE, html, 'utf8');
  writeProof();
}

if (require.main === module) patch();
module.exports = { patch, isKnownHeldModernDeckGrid };
