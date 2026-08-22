'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const SELLERS=path.join(ROOT,'data','sellers.json');const TX=path.resolve(process.env.LEDGER_DATA_DIR||path.join(ROOT,'data','transactions'));const ADMIN_TOKEN=process.env.MARKETPLACE_ADMIN_TOKEN||'';
const billboardRoutes=require('./billboard');
const SITE_ROOT=path.join(ROOT,'compiled','website');
const MIME='text/html; charset=utf-8';
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function write(file,v){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');}
function authorized(req){return Boolean(ADMIN_TOKEN)&&String(req.headers['authorization']||'')===`Bearer ${ADMIN_TOKEN}`;}
async function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1000000)req.destroy();});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});req.on('error',reject);});}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function htmlFile(res,file){fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end('Not Found');}res.writeHead(200,{'Content-Type':MIME,'Cache-Control':'no-store'});res.end(data);});}
async function cubeData(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return {items:[]};const r=await fetch(url+'/rest/v1/b2b_marketplace_catalog?select=*&order=title.asc',{headers:{apikey:key,Authorization:'Bearer '+key}});if(!r.ok)throw new Error('cube catalog unavailable');return {items:await r.json()};}
async function handle(req,res,url){
if(req.method==='GET'&&url==='/billboard'){htmlFile(res,path.join(SITE_ROOT,'billboard.html'));return true;}
if(req.method==='GET'&&url==='/marketplace.html'){htmlFile(res,path.join(SITE_ROOT,'marketplace.html'));return true;}
if(req.method==='GET'&&url==='/media-music.html'){htmlFile(res,path.join(SITE_ROOT,'media-music.html'));return true;}
if(req.method==='GET'&&url==='/digital-products.html'){htmlFile(res,path.join(SITE_ROOT,'digital-products.html'));return true;}
if(req.method==='GET'&&url==='/nz-secondhand.html'){htmlFile(res,path.join(SITE_ROOT,'nz-secondhand.html'));return true;}
if(req.method==='GET'&&url==='/api/cube/silos'){return json(res,200,{schema:'CUBE/SILO-REGISTRY/v1',silos:[{id:'mtg',label:'Magic: The Gathering',route:'/mtg',inventory_mode:'physical'},{id:'dreammeez',label:'DreamMeez',route:'/dreammeez',inventory_mode:'digital'},{id:'media-music',label:'Media & Music',route:'/media-music.html',inventory_mode:'mixed'},{id:'digital-products',label:'Digital Products',route:'/digital-products.html',inventory_mode:'digital'},{id:'nz-secondhand',label:'NZ Secondhand',route:'/nz-secondhand.html',inventory_mode:'physical'},{id:'b2b',label:'B2B Marketplace',route:'/marketplace.html',inventory_mode:'mixed'}]});}
if(req.method==='GET'&&url==='/api/cube/marketplace'){try{return json(res,200,{schema:'CUBE/B2B-MARKETPLACE/v1',...(await cubeData()),supply_open:true});}catch{return json(res,200,{schema:'CUBE/B2B-MARKETPLACE/v1',items:[],supply_open:true});}}
if(url==='/api/billboard'||url.startsWith('/api/billboard/')||url.startsWith('/billboard/media/')){const handled=await billboardRoutes.handle(req,res,url);if(handled)return true;}
if(!url.startsWith('/api/sellers'))return false;
if(!authorized(req))return json(res,401,{error:'Unauthorized'});
if(req.method==='POST'&&url==='/api/sellers'){const b=await body(req);if(!b.id||!b.name)return json(res,400,{error:'id and name required'});const sellers=read(SELLERS,[]);if(sellers.some(x=>x.id===b.id))return json(res,409,{error:'seller already exists'});sellers.push({id:String(b.id),name:String(b.name),approved:Boolean(b.approved),registered_at:new Date().toISOString()});write(SELLERS,sellers);return json(res,201,{success:true});}
const m=url.match(/^\/api\/sellers\/([^/]+)\/payouts$/);
if(req.method==='GET'&&m){const sellerId=decodeURIComponent(m[1]);const files=fs.existsSync(TX)?fs.readdirSync(TX).filter(x=>x.endsWith('.json')):[];const transactions=[];for(const f of files){try{const t=read(path.join(TX,f),null);if(t&&t.seller===sellerId&&t.payment_status==='paid')transactions.push({transaction_id:t.transaction_id,amount_total_nzd:t.amount_total_nzd,net_to_seller_nzd:t.net_to_seller_nzd,payment_status:t.payment_status,created_at:t.created_at});}catch{}}const net=transactions.reduce((n,t)=>n+Number(t.net_to_seller_nzd||0),0);return json(res,200,{seller:sellerId,transaction_count:transactions.length,net_total_nzd:Math.round(net*100)/100,transactions});}
return false;}
module.exports={handle};
