'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const catalogPath = path.join(ROOT, 'marketplace', 'catalog', 'sku-seeds.json');
const pagePath = path.join(ROOT, 'marketplace', 'marketplace.html');
const DATA_ROOT = process.env.MARKETPLACE_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamledger-marketplace' : path.join(ROOT, 'data', 'marketplace'));
const LISTINGS = path.join(DATA_ROOT, 'listings.json');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');

function send(res, status, body, type) {
  res.writeHead(status, {'Content-Type': type || 'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), {recursive:true}); const tmp=file+'.tmp-'+process.pid+'-'+Date.now(); fs.writeFileSync(tmp, JSON.stringify(value,null,2)+'\n','utf8'); fs.renameSync(tmp,file); }
function sessionId(req) { const m=String(req.headers.cookie||'').match(/(?:^|;\s*)dreamiez_session=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; }
function body(req) { return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>200000)req.destroy(new Error('Request too large'));});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});req.on('error',reject);}); }
function seeds() { const parsed=readJson(catalogPath,{items:[]}); return Array.isArray(parsed.items)?parsed.items:[]; }
function publishedProducts() { if(!fs.existsSync(PRODUCTS)) return []; return fs.readdirSync(PRODUCTS).filter(n=>n.endsWith('.json')).map(n=>readJson(path.join(PRODUCTS,n),null)).filter(p=>p&&p.status==='published'&&p.commercial_truth&&p.commercial_truth.approval_required===false&&Number(p.inventory||0)>0).map(p=>({sku_id:p.id,title:p.name,description:p.description,price:Number(p.price)/100,currency:String(p.currency||'NZD').toUpperCase(),status:'VERIFIED_AVAILABLE',checkout_available:true,approval_required:false,checkout_route:'/api/offer-checkout/create',source:'approved_product'})); }
function publicCatalog() { return seeds().concat(publishedProducts()); }
function gauntlet(input) { const title=String(input.title||'').trim(); const description=String(input.description||'').trim(); const price=Number(input.price); const currency=String(input.currency||'NZD').trim().toUpperCase(); const failures=[]; if(title.length<3||title.length>120)failures.push('title_length'); if(description.length<10||description.length>4000)failures.push('description_length'); if(!Number.isFinite(price)||price<=0)failures.push('positive_price'); if(!/^[A-Z]{3}$/.test(currency))failures.push('currency'); return {pass:failures.length===0,failures}; }
function route(req,res) {
  const requestPath=String(req.url||'').split('?')[0];
  if(req.method==='GET'&&requestPath==='/marketplace'){try{return send(res,200,fs.readFileSync(pagePath,'utf8'),'text/html; charset=utf-8');}catch(_){return send(res,503,{error:'Marketplace surface unavailable'});}}
  if(req.method==='GET'&&requestPath==='/api/marketplace/catalog') return send(res,200,{schema:'bec-prime.marketplace.v2',items:publicCatalog()});
  if(req.method==='GET'&&requestPath==='/api/marketplace/my-listings') { const seller=sessionId(req); if(!seller)return send(res,401,{error:'login required'}); return send(res,200,{seller_id:seller,listings:readJson(LISTINGS,[]).filter(x=>x.seller_id===seller)}); }
  if(req.method==='POST'&&requestPath==='/api/marketplace/intake') { return body(req).then(input=>{const seller=sessionId(req);if(!seller)return send(res,401,{error:'login required'});const check=gauntlet(input);if(!check.pass)return send(res,422,{error:'listing failed deterministic intake gate',failures:check.failures});const listings=readJson(LISTINGS,[]);const listing={listing_id:'LST-'+crypto.randomUUID(),sku_id:'SKU-'+crypto.randomUUID(),seller_id:seller,title:String(input.title).trim(),description:String(input.description).trim(),price:Number(input.price),currency:String(input.currency).trim().toUpperCase(),category:String(input.category||'B2B').trim().slice(0,80),status:'PENDING_APPROVAL',approval_required:true,checkout_available:false,created_at:new Date().toISOString(),gauntlet:{verdict:'PASS',failures:[]}};listings.push(listing);writeJson(LISTINGS,listings);return send(res,201,{ok:true,listing});}).catch(err=>send(res,400,{error:err.message||'invalid listing'})); }
  return false;
}

const realCreateServer=http.createServer;
const baseCreateServer=function wrappedCreateServer(options,handler){if(typeof options==='function'){handler=options;options=undefined;}const wrapped=function(req,res){if(route(req,res))return;return handler(req,res);};return realCreateServer.call(http,options,wrapped);};
Object.defineProperty(http,'createServer',{configurable:true,enumerable:true,get:function(){return baseCreateServer;},set:function(_) {}});
