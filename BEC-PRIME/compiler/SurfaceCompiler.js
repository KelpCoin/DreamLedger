'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const INDEX = path.join(OUT, 'index.html');
const TEMPLATE = path.join(ROOT, 'surface', 'index.v2.template.html');
const MANIFEST = path.join(ROOT, 'manifests', 'CUBE-PUBLIC-SURFACE-MANIFEST.json');
const OFFERS = path.join(ROOT, 'catalog', 'offers', 'offers.json');
const IP = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const NEWS = path.join(ROOT, 'data', 'silo-news.json');
const AUCTIONS = path.join(ROOT, 'data', 'auctions.json');
const PROOF = path.join(ROOT, 'PROOF-CUBE-SURFACE-COMPILATION.json');
const FORBIDDEN_PUBLIC = [
  'amplissa','bbw','big beautiful women','adult-only','adult only','stripe_secret_key','stripe_webhook_secret',
  '/var/data/','127.0.0.1','BEC-PRIME','ELOHIM','internal control plane','dreamiez','cinema-event-v1','/cinema.html'
];

function must(file){if(!fs.existsSync(file))throw new Error(`CUBE surface input missing: ${path.relative(ROOT,file)}`)}
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function json(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,'utf8')}
function assertClean(label,content){const lower=String(content).toLowerCase();const hit=FORBIDDEN_PUBLIC.find(token=>lower.includes(token.toLowerCase()));if(hit)throw new Error(`PUBLIC_SURFACE_GATE_FAILED: ${label} contains forbidden token: ${hit}`)}
function accountShell(title,body){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | DreamLedger</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f6f7f9;color:#17191d}main{max-width:520px;margin:7vh auto;padding:28px;background:#fff;border:1px solid #ddd;border-radius:16px}h1{margin-top:0}label{display:block;margin:14px 0 6px;font-weight:600}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #bbb;border-radius:9px;font:inherit}button{margin-top:18px;padding:12px 16px;border:0;border-radius:9px;background:#17191d;color:#fff;font:inherit;cursor:pointer}.muted{color:#666}.error{color:#b00020;margin-top:12px}a{color:inherit}</style></head><body><main>${body}</main></body></html>`}
function buildAccountPages(){
  write(path.join(OUT,'login.html'),accountShell('Log in',`<h1>Log in</h1><p class="muted">Use your DreamLedger account.</p><form id="login"><label>Email</label><input id="email" type="email" autocomplete="email" required><label>Password</label><input id="password" type="password" autocomplete="current-password" required><button type="submit">Log in</button><div id="msg"></div></form><p><a href="/register.html">Create a DreamLedger account</a></p><script>document.getElementById('login').addEventListener('submit',async(e)=>{e.preventDefault();const msg=document.getElementById('msg');msg.textContent='Signing in...';try{const r=await fetch('/api/account/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Login failed');location.href=d.next||'/account.html'}catch(err){msg.className='error';msg.textContent=err.message}});</script>`));
  write(path.join(OUT,'register.html'),accountShell('Create account',`<h1>Create your account</h1><p class="muted">Create a standard DreamLedger account.</p><form id="register"><label>Name</label><input id="name" autocomplete="name" required><label>Email</label><input id="email" type="email" autocomplete="email" required><label>Password</label><input id="password" type="password" minlength="8" autocomplete="new-password" required><button type="submit">Create account</button><div id="msg"></div></form><p><a href="/login.html">Already have an account? Log in</a></p><script>document.getElementById('register').addEventListener('submit',async(e)=>{e.preventDefault();const msg=document.getElementById('msg');msg.textContent='Creating account...';try{const r=await fetch('/api/account/register',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('name').value,email:document.getElementById('email').value,password:document.getElementById('password').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Registration failed');location.href=d.next||'/account.html'}catch(err){msg.className='error';msg.textContent=err.message}});</script>`));
  write(path.join(OUT,'account.html'),accountShell('Account',`<h1>Your DreamLedger account</h1><div id="state">Loading...</div><p><a href="/">Back to store</a></p><script>async function load(){const r=await fetch('/api/account/me',{credentials:'include',cache:'no-store'});const d=await r.json();const s=document.getElementById('state');if(!d.authenticated){s.innerHTML='<p>You are not logged in.</p><p><a href="/login.html">Log in</a> or <a href="/register.html">create an account</a>.</p>';return}s.innerHTML='<p>Signed in as <strong>'+String(d.account.name||'Customer').replace(/[<>]/g,'')+'</strong></p><p>'+String(d.account.email||'').replace(/[<>]/g,'')+'</p><button id="logout">Log out</button>';document.getElementById('logout').onclick=async()=>{await fetch('/api/account/logout',{method:'POST',credentials:'include'});location.href='/login.html'}}load().catch(()=>document.getElementById('state').textContent='Account service unavailable.');</script>`));
  write(path.join(OUT,'avatar.html'),accountShell('Avatar',`<h1>Account avatar</h1><p class="muted">A lightweight account profile surface. It is independent of any game or character product.</p><div id="state">Checking account...</div><script>fetch('/api/account/me',{credentials:'include',cache:'no-store'}).then(r=>r.json()).then(d=>{document.getElementById('state').textContent=d.authenticated?'Signed in as '+(d.account.email||'Customer'):'Please sign in first.'}).catch(()=>document.getElementById('state').textContent='Account service unavailable.');</script>`));
  write(path.join(OUT,'assets.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Assets | DreamLedger</title></head><body><main><h1>DreamLedger Assets</h1><p>Approved public commerce assets and product catalog references.</p><script>fetch('/api/products',{cache:'no-store'}).then(r=>r.json()).then(d=>document.body.insertAdjacentHTML('beforeend','<pre>'+JSON.stringify(d,null,2).replace(/[<>]/g,'')+'</pre>')).catch(()=>{});</script></main></body></html>`);
}

[TEMPLATE,MANIFEST,OFFERS,IP,PRODUCTS,NEWS,AUCTIONS].forEach(must);
fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});
const manifest=json(MANIFEST), offers=json(OFFERS), ip=json(IP), news=json(NEWS), auctions=json(AUCTIONS);
const template=fs.readFileSync(TEMPLATE,'utf8');
assertClean('template',template);
write(INDEX,template); assertClean('compiled index',fs.readFileSync(INDEX,'utf8'));
buildAccountPages();
for(const page of ['login.html','register.html','account.html','avatar.html','assets.html']){const html=fs.readFileSync(path.join(OUT,page),'utf8');if(page!=='assets.html'&&!html.includes('/api/account/'))throw new Error(`PRIMARY_ACCOUNT_SURFACE_FAILED: ${page}`);assertClean(page,html);}
const productCount=fs.readdirSync(PRODUCTS).filter(x=>x.endsWith('.json')).length;
const capabilityCount=Array.isArray(ip)?ip.length:(ip.capabilities||[]).length;
const offerCount=Array.isArray(offers)?offers.length:(offers.offers||[]).length;
const auctionCount=Array.isArray(auctions)?auctions.length:(auctions.auctions||[]).length;
const build={type:'dreamledger-public-surface-compilation',status:'PASS',compiler:'surface',schema:manifest.schema,compiled_at:new Date().toISOString(),source_hashes:{template:digest(TEMPLATE),manifest:digest(MANIFEST),offers:digest(OFFERS),ip:digest(IP),news:digest(NEWS),auctions:digest(AUCTIONS),surface_html:digest(INDEX)},counts:{capabilities:capabilityCount,offers:offerCount,products:productCount,news_silos:Object.keys(news).length,auctions:auctionCount},public_account_surfaces:['/login.html','/register.html','/account.html','/avatar.html','/assets.html'],public_surfaces:manifest.public_surfaces,gates:{approval_required_for_activation:manifest.surface_policy.approval_required_for_activation===true,private_material_excluded:manifest.surface_policy.private_material_excluded===true,silo_isolation_required:manifest.surface_policy.silo_isolation_required===true,forbidden_public_tokens_checked:true,template_compiled:true,primary_account_pages_compiled:true,excluded_surfaces:['cinema','dreamiez']}};
write(PROOF,JSON.stringify(build,null,2)+'\n');
console.log(JSON.stringify(build,null,2));
