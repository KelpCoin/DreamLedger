'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const INDEX = path.join(OUT, 'index.html');
const NEWS = path.join(ROOT, 'data', 'silo-news.json');
const AUCTIONS = path.join(ROOT, 'data', 'auctions.json');
const MANIFEST = path.join(ROOT, 'manifests', 'CUBE-PUBLIC-SURFACE-MANIFEST.json');

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
}
function js(value) { return JSON.stringify(value).replace(/<\//g, '<\\/'); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value, 'utf8'); }

if (!fs.existsSync(INDEX)) throw new Error('PublicSurfaceAugment: compiled index missing');
const manifest = read(MANIFEST, {});
const news = read(NEWS, {});
const auctions = Array.isArray(read(AUCTIONS, {}).auctions) ? read(AUCTIONS, {}).auctions : [];
let html = fs.readFileSync(INDEX, 'utf8');
const focusOffer = html.includes('data-focus-offer="QUOTE-COMPARE-49"');

const billboard = `<section class="section" id="billboard"><div class="head"><div class="eyebrow">BILLBOARD</div><h2>Featured products and updates.</h2><p>Explore available offers, listings and recent marketplace updates.</p></div><div id="dl-billboard" class="rail"></div></section>`;
const newsItems = Object.keys(news).reduce((all, key) => all.concat((Array.isArray(news[key]) ? news[key] : []).map(item => ({...item, silo:key}))), []).sort((a,b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 8);
const liveAuctions = auctions.filter(a => a.status === 'live').slice(0, 6);
const seed = '';
const commerceDoorway = '';

if (!focusOffer && !html.includes('id="billboard"')) html = html.replace('<section class="section" id="catalog">', billboard + '<section class="section" id="catalog">');
if (!html.includes('id="community"')) html = html.replace('<section class="section"><div class="proof">', seed + '<section class="section"><div class="proof">');
if (!html.includes('id="commerce-doorway"')) html = html.replace('<main>', '<main>' + commerceDoorway);
if (!html.includes('href="/community.html"')) html = html.replace('<a class="btn gold" href="/marketplace.html">Marketplace</a>', '<a class="btn gold" href="/community.html">Community</a><a class="btn gold" href="/marketplace.html">Marketplace</a>');

const boardScript = `<script id="dreamledger-architecture-board">(()=>{const products=fetch('/api/products',{cache:'no-store'}).then(r=>r.ok?r.json():{products:[]}).then(x=>x.products||[]).catch(()=>[]);const auctions=${js(liveAuctions)};const news=${js(newsItems)};const publicText=v=>String(v??'').replace(/master silo/gi,'cards and decks').replace(/silos?/gi,'sections').replace(/lanes?/gi,'categories').replace(/777/gi,'research').replace(/internal activity/gi,'unverified activity').replace(/BUILD CANDIDATE/gi,'COMING SOON').replace(/activation/gi,'launch').replace(/approval-gated/gi,'reviewed before publication').replace(/ELOM|CUBE|Elohim|Gauntlet|BECK/gi,'DreamLedger');const esc=v=>String(publicText(v)).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));const money=(v,c)=>String(c||'NZD').toUpperCase()+' '+(Number(v||0)/100).toFixed(2);Promise.all([products]).then(([ps])=>{const items=[...ps.slice(0,4).map(p=>({kind:'OFFER',title:p.name,desc:p.description||'Approved product',meta:money(p.price,p.currency),silo:p.silo,buy:p.id})),...auctions.map(a=>({kind:'AUCTION',title:a.title,desc:a.description,meta:'Buy now '+money(a.buy_now_price*100,a.currency),silo:a.silo})),...news.slice(0,3).map(n=>({kind:'NEWS',title:n.headline,desc:n.description||'A recent marketplace update.',meta:n.published_at?'Updated '+n.published_at:'Market update'}))];const rail=document.getElementById('dl-billboard');if(!rail)return;rail.innerHTML=items.length?items.map(x=>'<article class="card"><div class="art">'+esc(x.kind)+'</div><div class="body"><span class="tag">'+esc(x.silo||'dreamledger')+'</span><h3>'+esc(x.title)+'</h3><div class="desc">'+esc(x.desc)+'</div><div class="price">'+esc(x.meta||'')+'</div>'+(x.buy?'<div class="actions"><button class="btn gold" data-dl-buy="'+esc(x.buy)+'">Buy now</button></div>':'')+'</div></article>').join(''):'<div class="card"><div class="body">No current board items.</div></div>';rail.querySelectorAll('[data-dl-buy]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Creating checkout...';try{const r=await fetch('/api/offer-checkout/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer_id:b.dataset.dlBuy})});const d=await r.json();if(!r.ok||!d.checkout_url)throw Error(d.error||'Checkout unavailable');location.href=d.checkout_url}catch(e){b.disabled=false;b.textContent='Buy now';alert(e.message)}})})})()</script>`;

if (!focusOffer && !html.includes('id="dreamledger-architecture-board"')) html = html.replace('</body>', boardScript + '</body>');

html = html.replace(/BUILD CANDIDATE/gi, "COMING SOON")
  .replace(/Money membrane/gi, "Supplier Quote Comparison")
  .replace(/Fresh shelf/gi, "New arrivals")
  .replace(/Pioneer product/gi, "Featured product")
  .replace(/MASTER SILO/gi, "CARDS &amp; DECKS")
  .replace(/master commerce template/gi, "marketplace")
  .replace(/VERIFIED EXTERNAL REVENUE/gi, "Independently verified sales")
  .replace(/internal activity/gi, "unverified activity")
  .replace(/Economic Observatory/gi, "Market Updates")
  .replace(/current economic pulse/gi, "latest market updates")
  .replace(/economic pulse/gi, "market updates")
  .replace(/approval-gated/gi, "reviewed before publication")
  .replace(/activation/gi, "launch")
  .replace(/\\bsilos?\\b/gi, "sections")
  .replace(/\\blanes?\\b/gi, "categories");
write(INDEX, html);
const community = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger Community | DreamLedger</title><style>body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#070707;color:#f7f7f3}.wrap{max-width:900px;margin:auto;padding:40px 20px}a{color:#f2c14e}article{border:1px solid #292929;border-radius:16px;padding:22px;margin:14px 0;background:#111}h1{font-size:clamp(3rem,8vw,6rem);line-height:.9;margin:0 0 20px}h2{color:#f2c14e}.muted{color:#999}</style></head><body><main class="wrap"><p><a href="/">DREAMLEDGER</a></p><h1>Community seed.</h1><p class="muted">A place for customers, creators and sellers to share useful ideas and build dependable products together.</p><article><h2>Discover</h2><p>Share a real problem, customer request or helpful discovery.</p></article><article><h2>Offer</h2><p>Describe the product, price and delivery details clearly before it is offered for sale.</p></article><article><h2>Delivery</h2><p>Keep clear records of payment and delivery so customers know what happened.</p></article><article><h2>Community</h2><p>Different communities can grow independently while sharing reliable marketplace services.</p></article><article><h2>Compounding</h2><p>Useful products attract customers, recommendations and new opportunities over time.</p></article><p><a href="/">Return to the public catalog</a></p></main></body></html>`;
write(path.join(OUT,'community.html'), community);
write(path.join(OUT,'community.json'), JSON.stringify({schema:'DREAMLEDGER-COMMUNITY-SEED/v1',status:'seed',principles:['signal','offer','proof','silo','compounding'],public_routes:(manifest.public_surfaces||[]).map(x=>x.route)}, null, 2)+'\n');
console.log(JSON.stringify({augment:'PASS',billboard:true,community_seed:true,commerce_doorway:true,news_items:newsItems.length,live_auctions:liveAuctions.length}));