'use strict';
// Storefront server — public/ is Render rootDir. Whitelist + safe file fallback.
const http=require('http'),fs=require('fs'),path=require('path'),{URL}=require('url');
const tollRoad=require('../BEC-PRIME/routes/tollRoad');
const commercialCell=require('../BEC-PRIME/routes/commercialCell');
const PORT=Number(process.env.PORT||10000);
const COMMIT=process.env.RENDER_GIT_COMMIT||process.env.RENDER_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'unknown';
const ROOT=__dirname;
const ENGINE_INTERNAL_URL=String(process.env.ENGINE_INTERNAL_URL||'').replace(/\/$/,'');
const ENGINE_INTERNAL_API_KEY=String(process.env.ENGINE_INTERNAL_API_KEY||'');
const PUBLIC_FILES={
  '/':'index.html','/index.html':'index.html',
  '/catalogue':'catalogue.html','/catalogue/':'catalogue.html','/catalogue.html':'catalogue.html',
  '/app.js':'app.js',
  '/sell.html':'sell.html','/sell':'sell.html','/sell/':'sell.html',
  '/billboard':'billboard.html','/billboard/':'billboard.html','/billboard.html':'billboard.html',
  '/mtg':'mtg.html','/mtg/':'mtg.html','/mtg.html':'mtg.html',
  '/b2b':'b2b.html','/b2b/':'b2b.html','/b2b.html':'b2b.html',
  '/marketplace':'marketplace.html','/marketplace/':'marketplace.html','/marketplace.html':'marketplace.html',
  '/go':'marketplace.html','/go/':'marketplace.html',
  '/cost-of-living.html':'cost-of-living.html','/cost-of-living':'cost-of-living.html',
  '/truth-oracle.html':'truth-oracle.html','/truth-oracle':'truth-oracle.html',
  '/agent.json':'agent.json','/agent-commerce.json':'agent-commerce.json',
  '/catalog.json':'catalog.json','/surfaces.json':'surfaces.json',
  '/robots.txt':'robots.txt','/sitemap.xml':'sitemap.xml',
  '/quote-comparison':'quote-comparison/index.html','/quote-comparison/':'quote-comparison/index.html','/quote-comparison.html':'quote-comparison.html',
  '/overpaying':'overpaying.html','/overpaying.html':'overpaying.html',
  '/avatar.html':'avatar.html','/avatar':'avatar.html','/toll-road':'toll-road.html','/toll-road/':'toll-road.html'
};
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,s,b,t){if(res.writableEnded)return;res.statusCode=s;if(t)res.setHeader('Content-Type',t);res.end(b)}
function headers(res){
  res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('X-DreamLedger-Storefront','marketplace-v19');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com https://buy.stripe.com");
}
async function proxySwarm(req,res,p){if(!ENGINE_INTERNAL_URL)return send(res,503,'Swarm engine unavailable','text/plain; charset=utf-8');try{const target=ENGINE_INTERNAL_URL+(p.startsWith('/swarm/')?'/api/swarm-100k/'+p.split('/').pop():p);const h={};if(ENGINE_INTERNAL_API_KEY)h['x-api-key']=ENGINE_INTERNAL_API_KEY;const r=await fetch(target,{headers:h});const body=await r.text();res.statusCode=r.status;res.setHeader('Content-Type',r.headers.get('content-type')||'application/json; charset=utf-8');res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return res.end(body);}catch(e){return send(res,502,'Swarm engine unavailable','text/plain; charset=utf-8');}}
function serveFile(res,file){
  const safe=path.normalize(path.join(ROOT,file));
  if(!safe.startsWith(ROOT+path.sep) && safe!==ROOT) return send(res,403,'Forbidden','text/plain; charset=utf-8');
  fs.readFile(safe,(err,data)=>{
    if(err) return send(res,404,'Not Found','text/plain; charset=utf-8');
    const ext=path.extname(file).toLowerCase();
    send(res,200,data,MIME[ext]||'application/octet-stream');
  });
}
http.createServer(async (req,res)=>{
  headers(res);
  const u=new URL(req.url||'/','http://localhost');
  const p=u.pathname;
  if(req.method==='GET'&&p==='/healthz'){
    return send(res,200,JSON.stringify({ok:true,service:'dreamledger-storefront',commit:COMMIT}),'application/json; charset=utf-8');
  }
  if(req.method==='GET'&&p==='/version'){
    return send(res,200,JSON.stringify({service:'dreamledger-storefront',commit:COMMIT,surface:'marketplace-v19'}),'application/json; charset=utf-8');
  }
  if(req.method==='GET' && (p==='/api/offers' || p==='/api/products')){
    try{
      const catalogue=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json'),'utf8'));
      const products=Array.isArray(catalogue.products)?catalogue.products:[];
      const offers=products.filter(x=>x&&x.status==='published'&&x.checkout_available===true).map(x=>({
        product_id:x.id, sku:x.sku||null, name:x.name, description:x.description||null,
        price_nzd:x.currency==='nzd'?x.price:null, currency:x.currency||'nzd', silo:x.silo||null,
        checkout_url:x.checkout_url||null, fulfillment:x.fulfillment||null, status:'VERIFIED_AVAILABLE'
      }));
      return send(res,200,JSON.stringify({schema:'dreamledger/offers/v1',count:offers.length,offers,truth_rule:'settled_stripe_only'}),'application/json; charset=utf-8');
    }catch(error){ return send(res,500,JSON.stringify({error:'CATALOG_UNAVAILABLE'}),'application/json; charset=utf-8'); }
  }
  if(req.method==='GET' && (p==='/.well-known/ai'||p==='/.well-known/ai-catalog.json')){
    const file=p==='/.well-known/ai' ? '.well-known/ai' : '.well-known/ai-catalog.json';
    return serveFile(res,file);
  }
  if(req.method==='GET' && p==='/buy/QUOTE-COMPARE-49'){
    res.statusCode=302;
    res.setHeader('Location','https://buy.stripe.com/14AdR97LD6pLfuLdVadwc32');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-DreamLedger-Buy-Router','QUOTE-COMPARE-49');
    return res.end();
  }
  if(req.method==='GET' && p.startsWith('/buy/')){
    try{
      const productId=decodeURIComponent(p.slice('/buy/'.length));
      const catalogue=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json'),'utf8'));
      const product=(Array.isArray(catalogue.products)?catalogue.products:[]).find(x=>x&&x.id===productId&&x.status==='published'&&x.checkout_available===true&&typeof x.checkout_url==='string');
      if(!product) return send(res,404,'Not Found','text/plain; charset=utf-8');
      res.statusCode=302;res.setHeader('Location',product.checkout_url);return res.end();
    }catch(error){return send(res,500,'Catalog unavailable','text/plain; charset=utf-8');}
  }
  if(req.method==='GET' && p==='/api/toll/v1/manifest'){
    try{
      const manifest=tollRoad.publicManifest();
      return send(res,200,JSON.stringify(manifest),'application/json; charset=utf-8');
    }catch(error){
      return send(res,500,JSON.stringify({error:'TOLL_MANIFEST_UNAVAILABLE',message:String(error&&error.message||error)}),'application/json; charset=utf-8');
    }
  }
  if(p.startsWith('/api/toll/v1/')){
    try{
      const handled=await tollRoad.handle(req,res,p);
      if(handled)return;
    }catch(error){
      return send(res,error.statusCode||500,JSON.stringify({error:String(error&&error.message||error)}),'application/json; charset=utf-8');
    }
    return send(res,404,'Not Found','text/plain; charset=utf-8');
  }
  if(req.method==='GET' && /^\/swarm\/\d{1,6}$/.test(p)) return proxySwarm(req,res,p);
  if(req.method==='GET' && /^\/api\/swarm-100k\/\d{1,6}$/.test(p)) return proxySwarm(req,res,p);
  if(req.method==='GET' && p==='/api/swarm-100k/summary') return proxySwarm(req,res,p);
  if(p.startsWith('/api/commercial/') || p==='/api/webhooks/stripe'){
    try{
      const handled=await commercialCell.handle(req,res,p);
      if(handled)return;
    }catch(error){
      return send(res,error.statusCode||500,JSON.stringify({error:String(error&&error.message||error)}),'application/json; charset=utf-8');
    }
  }
  if(req.method!=='GET') return send(res,405,'Method Not Allowed','text/plain; charset=utf-8');
  const file=PUBLIC_FILES[p];
  if(file) return serveFile(res,file);
  if(p.indexOf('..')!==-1) return send(res,403,'Forbidden','text/plain; charset=utf-8');
  const rel=p.replace(/^\//,'');
  if(rel && fs.existsSync(path.join(ROOT,rel)) && fs.statSync(path.join(ROOT,rel)).isFile()){
    return serveFile(res,rel);
  }
  if(rel && fs.existsSync(path.join(ROOT,rel,'index.html')) && fs.statSync(path.join(ROOT,rel,'index.html')).isFile()){
    return serveFile(res,path.join(rel,'index.html'));
  }
  return send(res,404,'Not Found','text/plain; charset=utf-8');
}).listen(PORT,'0.0.0.0',()=>console.log('storefront listening',PORT,'commit',COMMIT));
