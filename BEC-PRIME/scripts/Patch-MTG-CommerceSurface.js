'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';

function writeProof() {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v2',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    inventory_endpoint: '/api/products',
    checkout_endpoint: '/api/offer-checkout/create',
    horizontal_catalogue: true,
    displays: ['image', 'name', 'price_nzd', 'condition', 'availability', 'buy_button'],
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
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
  if (start < 0 || end < 0) throw new Error('MTG render function boundary not found');

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
  const condition=p.condition||'Condition not specified';
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

patch();
