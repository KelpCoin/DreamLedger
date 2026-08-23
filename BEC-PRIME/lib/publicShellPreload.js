'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'compiled', 'website');
const PRODUCT_CATALOG = path.join(ROOT, 'catalog', 'products');
const billboard = require('../routes/billboard');
const original = http.createServer;
const EXCLUDED_ROUTES = new Set(['/dreamiez','/dreammeez']);
const EXCLUDED_SILOS = new Set(['SILO_DREAMIEZ','dreamiez','SILO_CINEMA']);
function safePublicProductFiles(){
  if(!fs.existsSync(PRODUCT_CATALOG)) return [];
  return fs.readdirSync(PRODUCT_CATALOG).filter(n=>n.endsWith('.json')).map(n=>{
    try{return JSON.parse(fs.readFileSync(path.join(PRODUCT_CATALOG,n),'utf8'));}catch{return null;}
  }).filter(p=>p&&p.status==='published'&&p.commercial_truth&&p.commercial_truth.approval_required===false&&!EXCLUDED_SILOS.has(String(p.silo||'')));
}
function isExcludedPublicRoute(route){
  const value=String(route||'').split('?')[0].toLowerCase();
  return EXCLUDED_ROUTES.has(value)||value.includes('/dreamiez')||value.includes('/dreammeez');
}
function htmlFile(route){
  const map={
    '/':'index.html',
    '/mtg':path.join('mtg','index.html'),
    '/commander':path.join('commander','index.html'),
    '/cinema':'../../cinema.html',
    '/cinema/':'../../cinema.html',
    '/cinema.html':'../../cinema.html',
    '/billboard':'billboard.html',
    '/billboard/':'billboard.html',
    '/billboard-review':'billboard-review.html',
    '/billboard-review/':'billboard-review.html'
  };
  return map[route]||null;
}
function shell(file){
  const full=path.join(PUBLIC,file);
  if(!fs.existsSync(full)) return null;
  let html=fs.readFileSync(full,'utf8');
  if(!html.includes('/assets/digital-proxy-assist.js')) html=html.replace('</body>','<script src="/assets/digital-proxy-assist.js" defer></script></body>');
  return Buffer.from(html,'utf8');
}
function sendJson(res,status,data){
  if(res.writableEnded)return true;
  const body=Buffer.from(JSON.stringify(data));
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':String(body.length)});
  res.end(body);
  return true;
}
http.createServer=function publicShellCreateServer(...args){
  const handler=args[0];
  if(typeof handler!=='function') return original.apply(this,args);
  args[0]=async function publicShellHandler(req,res){
    const route=String(req.url||'').split('?')[0];
    if(req.method==='GET'&&isExcludedPublicRoute(route)) return sendJson(res,404,{error:'Route excluded from production surface'});
    if(req.method==='GET'&&route==='/api/products'){
      const products=safePublicProductFiles().map(p=>({id:p.id,silo:p.silo,name:p.name,description:p.description,price:Number(p.price),currency:p.currency,inventory:Number(p.inventory),status:'published',approval_required:false,checkout_available:Number(p.inventory)>0}));
      return sendJson(res,200,{products});
    }
    if(req.method==='GET'){
      const file=htmlFile(route);
      if(file){const payload=shell(file);if(payload){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':String(payload.length)});return res.end(payload);}}
    }
    try{if(await billboard.handle(req,res,route))return;}catch(err){return sendJson(res,500,{error:err.message||'Billboard route failed'});}
    return handler(req,res);
  };
  return original.apply(this,args);
};
