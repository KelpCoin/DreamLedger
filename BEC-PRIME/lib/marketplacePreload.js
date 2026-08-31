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
const EVENTS = path.join(DATA_ROOT, 'events.jsonl');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const auth = require('../routes/auth');

function send(res, status, body, type) {
  res.writeHead(status, {'Content-Type': type || 'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), {recursive:true}); const tmp=file+'.tmp-'+process.pid+'-'+Date.now(); fs.writeFileSync(tmp, JSON.stringify(value,null,2)+'\n','utf8'); fs.renameSync(tmp,file); }
function appendEvent(event) { fs.mkdirSync(path.dirname(EVENTS), {recursive:true}); fs.appendFileSync(EVENTS, JSON.stringify(event)+'\n','utf8'); }
function sessionId(req) { const m=String(req.headers.cookie||'').match(/(?:^|;\s*)dreamiez_session=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; }
function body(req) { return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>200000)req.destroy(new Error('Request too large'));});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});req.on('error',reject);}); }
function seeds() { const parsed=readJson(catalogPath,{items:[]}); return Array.isArray(parsed.items)?parsed.items:[]; }
function publishedProducts() { if(!fs.existsSync(PRODUCTS)) return []; return fs.readdirSync(PRODUCTS).filter(n=>n.endsWith('.json')).map(n=>readJson(path.join(PRODUCTS,n),null)).filter(p=>p&&p.status==='published'&&p.commercial_truth&&p.commercial_truth.approval_required===false&&Number(p.inventory||0)>0).map(p=>({sku_id:p.id,title:p.name,description:p.description,price:Number(p.price)/100,currency:String(p.currency||'NZD').toUpperCase(),status:'VERIFIED_AVAILABLE',checkout_available:true,approval_required:false,checkout_route:'/api/offer-checkout/create',source:'approved_product'})); }
function publicCatalog() { return seeds().concat(publishedProducts()); }
function asciiOnly(value) { return /^[\x00-\x7F]*$/.test(String(value)); }
function gauntlet(input) {
  const title=String(input.title||'').trim();
  const description=String(input.description||'').trim();
  const price=Number(input.price);
  const currency=String(input.currency||'NZD').trim().toUpperCase();
  const category=String(input.category||'B2B').trim();
  const failures=[];
  if(!title || title.length<3 || title.length>120) failures.push('title_length');
  if(!description || description.length<10 || description.length>4000) failures.push('description_length');
  if(!Number.isFinite(price) || price<=0 || price>100000000) failures.push('positive_bounded_price');
  if(!/^[A-Z]{3}$/.test(currency)) failures.push('currency');
  if(!category || category.length>80) failures.push('category_length');
  if(!asciiOnly(title)||!asciiOnly(description)||!asciiOnly(category)) failures.push('ascii_only');
  const normalized={title,description,price,currency,category};
  const checks={
    title_present:title.length>=3,
    description_present:description.length>=10,
    positive_price:Number.isFinite(price)&&price>0,
    currency_iso3:/^[A-Z]{3}$/.test(currency),
    category_present:category.length>0,
    ascii_only:asciiOnly(title)&&asciiOnly(description)&&asciiOnly(category)
  };
  const passed=Object.keys(checks).filter(k=>checks[k]).length;
  const score=Math.round((passed/Object.keys(checks).length)*100);
  return {pass:failures.length===0,failures,score,checks,normalized,verdict:failures.length===0?'PASS':'QUARANTINE'};
}
function route(req,res) {
  const requestPath=String(req.url||'').split('?')[0];
  if(req.method==='GET'&&requestPath==='/healthz') return send(res,200,{status:'ok'});
  if(requestPath.startsWith('/api/account/')) return auth.handle(req,res,requestPath);
  if(req.method==='GET'&&requestPath==='/marketplace'){try{return send(res,200,fs.readFileSync(pagePath,'utf8'),'text/html; charset=utf-8');}catch(_){return send(res,503,{error:'Marketplace surface unavailable'});}}
  if(req.method==='GET'&&requestPath==='/api/marketplace/catalog') return send(res,200,{schema:'bec-prime.marketplace.v3',items:publicCatalog()});
  if(req.method==='GET'&&requestPath==='/api/marketplace/my-listings') { const seller=sessionId(req); if(!seller)return send(res,401,{error:'login required'}); return send(res,200,{seller_id:seller,listings:readJson(LISTINGS,[]).filter(x=>x.seller_id===seller)}); }
  if(req.method==='POST'&&requestPath==='/api/marketplace/intake') { return body(req).then(input=>{
    const seller=sessionId(req);
    if(!seller)return send(res,401,{error:'login required'});
    const receivedAt=new Date().toISOString();
    const signalId='SIG-'+crypto.randomUUID();
    appendEvent({event_id:'EVT-'+crypto.randomUUID(),event_type:'SIGNAL_RECEIVED',signal_id:signalId,seller_id:seller,received_at:receivedAt,raw_signal:{title:input.title,description:input.description,price:input.price,currency:input.currency,category:input.category}});
    const check=gauntlet(input);
    if(!check.pass) {
      appendEvent({event_id:'EVT-'+crypto.randomUUID(),event_type:'SIGNAL_QUARANTINED',signal_id:signalId,seller_id:seller,occurred_at:new Date().toISOString(),gauntlet:check});
      return send(res,422,{ok:false,signal_id:signalId,verdict:'QUARANTINE',gauntlet:check});
    }
    const listings=readJson(LISTINGS,[]);
    const normalized=check.normalized;
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify({seller_id:seller,...normalized})).digest('hex');
    const duplicate=listings.find(x=>x.seller_id===seller&&x.signal_fingerprint===fingerprint);
    if(duplicate) return send(res,200,{ok:true,idempotent:true,listing:duplicate});
    const listing={listing_id:'LST-'+crypto.randomUUID(),signal_id:signalId,sku_id:'SKU-'+crypto.randomUUID(),seller_id:seller,title:normalized.title,description:normalized.description,price:normalized.price,currency:normalized.currency,category:normalized.category,status:'PENDING_APPROVAL',approval_required:true,checkout_available:false,created_at:receivedAt,signal_fingerprint:fingerprint,gauntlet:{verdict:'PASS',score:check.score,checks:check.checks}};
    listings.push(listing); writeJson(LISTINGS,listings);
    appendEvent({event_id:'EVT-'+crypto.randomUUID(),event_type:'OPPORTUNITY_CREATED',signal_id:signalId,listing_id:listing.listing_id,sku_id:listing.sku_id,seller_id:seller,occurred_at:new Date().toISOString(),gauntlet:listing.gauntlet,state:'PENDING_APPROVAL'});
    return send(res,201,{ok:true,signal_id:signalId,listing,gauntlet:check});
  }).catch(err=>send(res,400,{error:err.message||'invalid listing'})); }
  return false;
}

const realCreateServer=http.createServer;
const baseCreateServer=function wrappedCreateServer(options,handler){if(typeof options==='function'){handler=options;options=undefined;}const wrapped=function(req,res){if(route(req,res))return;return handler(req,res);};return realCreateServer.call(http,options,wrapped);};
Object.defineProperty(http,'createServer',{configurable:true,enumerable:true,get:function(){return baseCreateServer;},set:function(_) {}});
