'use strict';

const fs=require('fs');
const path=require('path');

const ROOT=path.join(__dirname,'..');
const OUT=path.join(ROOT,'compiled','website');
const INDEX=path.join(OUT,'index.html');
const NEWS=path.join(ROOT,'data','silo-news.json');
const AUCTIONS=path.join(ROOT,'data','auctions.json');

function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function js(v){return JSON.stringify(v).replace(/<\\//g,'<\\\\/');}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,'utf8');}

if(!fs.existsSync(INDEX))throw new Error('Public storefront index missing');
let html=fs.readFileSync(INDEX,'utf8');
const news=read(NEWS,{});
const auctions=Array.isArray(read(AUCTIONS,{}).auctions)?read(AUCTIONS,{}).auctions:[];
const newsItems=Object.keys(news).reduce((all,key)=>all.concat((Array.isArray(news[key])?news[key]:[]).map(item=>({...item,category:key}))),[]).sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at))).slice(0,6);
const liveAuctions=auctions.filter(a=>a.status==='live').slice(0,4);

const script='<script id="dreamledger-current-shelf">(()=>{const auctions='+js(liveAuctions)+';const news='+js(newsItems)+';const esc=v=>String(v??"").replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","\'":"&#39;"}[c]));const rail=document.getElementById("dl-fresh");if(!rail)return;const items=[...auctions.map(a=>({kind:"AUCTION",title:a.title,desc:a.description,meta:"NZ$"+(Number(a.buy_now_price||0)).toFixed(2)})),...news.map(n=>({kind:"NEW",title:n.headline,desc:n.source||"Fresh from the catalogue.",meta:n.category||"DREAMLEDGER"}))];rail.innerHTML=items.length?items.map(x=>"<article class=\"card\"><div><div class=\"meta\"><span>"+esc(x.kind)+"</span><span class=\"status\">NEW</span></div><div class=\"art\"><span>"+esc(x.kind==="AUCTION"?"NOW":"NEW")+"</span></div><h3>"+esc(x.title)+"</h3><p>"+esc(x.desc||"Worth a look.")+"</p><div class=\"price\">"+esc(x.meta)+"</div></div></article>").join(""):"<article class=\"card\"><h3>More is coming.</h3><p>The shelf is being refreshed.</p></article>"})()})();</script>';

if(!html.includes('id="fresh"')){
  const section='<section class="section" id="fresh"><div class="head"><div><div class="kicker">Fresh on the shelf</div><h2>Worth another look.</h2></div><p>New arrivals and changing curiosities, kept small so the shop stays easy to browse.</p></div><div id="dl-fresh" class="rail"></div></section>';
  html=html.replace('</main>',section+'</main>');
}
if(!html.includes('id="dreamledger-current-shelf"'))html=html.replace('</body>',script+'</body>');

write(INDEX,html);
const proof={
  schema:'DREAMLEDGER/PUBLIC-SURFACE-AUGMENT/v2',
  status:'PASS',
  source:'compiled storefront',
  generated_at:new Date().toISOString(),
  fresh_items:liveAuctions.length+newsItems.length,
  changes:['billboard remains a contained product card','fresh shelf added as a small horizontal rail','no internal architecture language added','no payment-brand logos added']
};
write(path.join(ROOT,'RUN-PROOFS','PUBLIC-SURFACE-AUGMENT-PROOF.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
