'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const INDEX = path.join(OUT, 'index.html');
const CATALOG_TEMPLATE = path.join(ROOT, 'surface', 'catalog.html');
const CINEMA_TEMPLATE = path.join(ROOT, 'surface', 'cinema.html');
const DIGITAL_TEMPLATE = path.join(ROOT, 'surface', 'digital-products.html');
const MANIFEST = path.join(ROOT, 'manifests', 'CUBE-PUBLIC-SURFACE-MANIFEST.json');
const OFFERS = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const IP = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const NEWS = path.join(ROOT, 'data', 'silo-news.json');
const AUCTIONS = path.join(ROOT, 'data', 'auctions.json');
const BILLBOARDS = path.join(ROOT, '..', 'commerce', 'dreamledger-regional-billboard-offers.json');
const PROOF = path.join(ROOT, 'PROOF-CUBE-SURFACE-COMPILATION.json');
const FORBIDDEN_PUBLIC = ['amplissa','bbw','big beautiful women','adult-only','adult only','stripe_secret_key','stripe_webhook_secret','/var/data/','127.0.0.1','BEC-PRIME','ELOHIM','internal control plane','CollectorsCoast','HappyHomarid'];

function must(file){if(!fs.existsSync(file))throw new Error('CUBE surface input missing: '+path.relative(ROOT,file));}
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function json(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,'utf8');}
function assertClean(label,content){const lower=String(content).toLowerCase();const hit=FORBIDDEN_PUBLIC.find(token=>lower.includes(token.toLowerCase()));if(hit)throw new Error('PUBLIC_SURFACE_GATE_FAILED: '+label+' contains forbidden token: '+hit);}
function accountShell(title,body){return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' | DreamLedger</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f6f7f9;color:#17191d}main{max-width:520px;margin:7vh auto;padding:28px;background:#fff;border:1px solid #ddd;border-radius:16px}h1{margin-top:0}label{display:block;margin:14px 0 6px;font-weight:600}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #bbb;border-radius:9px;font:inherit}button{margin-top:18px;padding:12px 16px;border:0;border-radius:9px;background:#17191d;color:#fff;font:inherit;cursor:pointer}.muted{color:#666}.error{color:#b00020;margin-top:12px}a{color:inherit}</style></head><body><main>'+body+'</main></body></html>';}
function buildAccountPages(){
  write(path.join(OUT,'login.html'),accountShell('Log in','<h1>Log in</h1><p class="muted">Use your DreamLedger account.</p><form id="login"><label>Email</label><input id="email" type="email" required><label>Password</label><input id="password" type="password" required><button type="submit">Log in</button><div id="msg"></div></form><p><a href="/register.html">Create a DreamLedger account</a></p><script>document.getElementById("login").addEventListener("submit",async(e)=>{e.preventDefault();const m=document.getElementById("msg");try{const r=await fetch("/api/account/login",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.value,password:password.value})});const d=await r.json();if(!r.ok)throw Error(d.error||"Login failed");location.href=d.next||"/account.html"}catch(x){m.className="error";m.textContent=x.message}});</script>'));
  write(path.join(OUT,'register.html'),accountShell('Create account','<h1>Create account</h1><p class="muted">Create a standard DreamLedger account.</p><form id="register"><label>Name</label><input id="name" required><label>Email</label><input id="email" type="email" required><label>Password</label><input id="password" type="password" minlength="8" required><button type="submit">Create account</button><div id="msg"></div></form><p><a href="/login.html">Log in</a></p><script>document.getElementById("register").addEventListener("submit",async(e)=>{e.preventDefault();const m=document.getElementById("msg");try{const r=await fetch("/api/account/register",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.value,email:email.value,password:password.value})});const d=await r.json();if(!r.ok)throw Error(d.error||"Registration failed");location.href=d.next||"/account.html"}catch(x){m.className="error";m.textContent=x.message}});</script>'));
  write(path.join(OUT,'account.html'),accountShell('Account','<h1>Your DreamLedger account</h1><div id="state">Loading...</div><p><a href="/">Back to store</a></p><script>fetch("/api/account/me",{credentials:"include",cache:"no-store"}).then(r=>r.json()).then(d=>document.getElementById("state").innerHTML=d.authenticated?"<p>Signed in as <strong>"+String(d.account.name||"Customer").replace(/[<>]/g,"")+"</strong></p>":"<p>Not signed in. <a href=\"/login.html\">Log in</a></p>").catch(()=>document.getElementById("state").textContent="Account service unavailable.");</script>'));
  write(path.join(OUT,'avatar.html'),accountShell('Avatar','<h1>Account avatar</h1><p class="muted">Avatar and identity surface. Independent from commerce inventory.</p><div id="state">Checking account...</div><script>fetch("/api/account/me",{credentials:"include",cache:"no-store"}).then(r=>r.json()).then(d=>document.getElementById("state").textContent=d.authenticated?"Signed in as "+(d.account.email||"Customer"):"Please sign in first.").catch(()=>document.getElementById("state").textContent="Account service unavailable.");</script>'));
  write(path.join(OUT,'assets.html'),'<main><h1>DreamLedger Assets</h1><p>Approved public commerce assets.</p></main>');
}

[TEMPLATE,MANIFEST,OFFERS,IP,PRODUCTS,NEWS,AUCTIONS,CATALOG_TEMPLATE,CINEMA_TEMPLATE,DIGITAL_TEMPLATE,BILLBOARDS].forEach(()=>{});
const required=[MANIFEST,OFFERS,IP,PRODUCTS,NEWS,AUCTIONS,CATALOG_TEMPLATE,CINEMA_TEMPLATE,DIGITAL_TEMPLATE,BILLBOARDS];
required.forEach(must);
fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});
const manifest=json(MANIFEST), offers=json(OFFERS), ip=json(IP), news=json(NEWS), auctions=json(AUCTIONS), billboards=json(BILLBOARDS);
let html=fs.readFileSync(CATALOG_TEMPLATE,'utf8');
html=html.replace('__NEWS_JSON__',JSON.stringify(news).replace(/</g,'\\u003c'));
html=html.replace('__BILLBOARDS_JSON__',JSON.stringify(billboards).replace(/</g,'\\u003c'));
assertClean('catalog',html);
write(INDEX,html);
write(path.join(OUT,'cinema.html'),fs.readFileSync(CINEMA_TEMPLATE,'utf8'));
write(path.join(OUT,'digital-products.html'),fs.readFileSync(DIGITAL_TEMPLATE,'utf8'));
assertClean('cinema',fs.readFileSync(path.join(OUT,'cinema.html'),'utf8'));
assertClean('digital-products',fs.readFileSync(path.join(OUT,'digital-products.html'),'utf8'));
buildAccountPages();
for(const page of ['login.html','register.html','account.html','avatar.html','assets.html']){const h=fs.readFileSync(path.join(OUT,page),'utf8');assertClean(page,h);}
const productCount=fs.readdirSync(PRODUCTS).filter(x=>x.endsWith('.json')).length;
const capabilityCount=Array.isArray(ip)?ip.length:(ip.capabilities||[]).length;
const offerCount=Array.isArray(offers)?offers.length:(offers.offers||[]).length;
const auctionCount=Array.isArray(auctions)?auctions.length:(auctions.auctions||[]).length;
const newsSilos=Object.keys(news||{}).length;
const billboardCount=Array.isArray(billboards.boards)?billboards.boards.length:0;
const build={type:'dreamledger-public-surface-compilation',status:'PASS',compiler:'surface-stable-v1',schema:manifest.schema,compiled_at:new Date().toISOString(),source_hashes:{catalog_template:digest(CATALOG_TEMPLATE),cinema_template:digest(CINEMA_TEMPLATE),digital_template:digest(DIGITAL_TEMPLATE),manifest:digest(MANIFEST),offers:digest(OFFERS),ip:digest(IP),news:digest(NEWS),auctions:digest(AUCTIONS),billboards:digest(BILLBOARDS),surface_html:crypto.createHash('sha256').update(html,'utf8').digest('hex')},counts:{capabilities:capabilityCount,offers:offerCount,products:productCount,news_silos:newsSilos,auctions:auctionCount,billboards:billboardCount},public_account_surfaces:['/login.html','/register.html','/account.html','/avatar.html','/assets.html'],public_surfaces:manifest.public_surfaces,gates:{approval_required_for_activation:manifest.surface_policy.approval_required_for_activation===true,private_material_excluded:manifest.surface_policy.private_material_excluded===true,silo_isolation_required:manifest.surface_policy.silo_isolation_required===true,forbidden_public_tokens_checked:true,template_compiled:true,cinema_surface_compiled:true,digital_products_surface_compiled:true,primary_account_pages_compiled:true,billboard_rail_compiled:true,news_ticker_compiled:true}};
write(PROOF,JSON.stringify(build,null,2)+'\n');
console.log(JSON.stringify(build,null,2));
