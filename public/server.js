'use strict';
// Storefront server — public/ is Render rootDir. Whitelist + safe file fallback.
const http=require('http'),fs=require('fs'),path=require('path'),{URL}=require('url');
const commercialCell=require('../BEC-PRIME/routes/commercialCell');
const tollRoad=require('../BEC-PRIME/routes/tollRoad');
const TollRuntime=require('../BEC-PRIME/runtime/TollRoad');
const PORT=Number(process.env.PORT||10000);
const COMMIT=process.env.RENDER_GIT_COMMIT||process.env.RENDER_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'unknown';
const ROOT=__dirname;
const ENGINE_INTERNAL_URL=String(process.env.ENGINE_INTERNAL_URL||'').replace(/\/$/,'');
const ENGINE_INTERNAL_API_KEY=String(process.env.ENGINE_INTERNAL_API_KEY||'');
const PUBLIC_FILES={
  '/':'home.html','/index.html':'home.html','/status':'status.html','/status/':'status.html','/status.html':'status.html',
  '/about':'about.html','/about/':'about.html','/privacy':'privacy.html','/privacy/':'privacy.html','/privacy.html':'privacy.html','/terms':'terms.html','/terms/':'terms.html','/terms.html':'terms.html','/security':'security.html','/security/':'security.html','/security.html':'security.html','/contact':'contact.html','/contact/':'contact.html','/trust':'trust.html','/trust/':'trust.html',
  '/catalogue':'catalogue.html','/catalogue/':'catalogue.html','/catalogue.html':'catalogue.html',
  '/app.js':'app.js',
  '/sell.html':'sell.html','/sell':'sell.html','/sell/':'sell.html',
  '/billboard':'billboard.html','/billboard/':'billboard.html','/billboard.html':'billboard.html',
  '/mtg':'mtg/index.html','/mtg/':'mtg/index.html','/mtg.html':'mtg/index.html','/mtg/index.html':'mtg/index.html',
  '/demand-services':'demand-services.html','/demand-services/':'demand-services.html',
  '/fightedge':'fightedge/index.html','/fightedge/':'fightedge/index.html',
  '/commander-guide':'commander-guide.html','/commander-guide/':'commander-guide.html',
  '/agent-commerce':'agent-commerce.html','/agent-commerce/':'agent-commerce.html','/agentic-commerce':'agentic-commerce.html','/agentic-commerce/':'agentic-commerce.html','/revenue.html':'agentic-commerce.html','/revenue':'agentic-commerce.html',
  '/b2b':'b2b.html','/b2b/':'b2b.html','/b2b.html':'b2b.html',
  '/marketplace':'marketplace.html','/marketplace/':'marketplace.html','/marketplace.html':'marketplace.html',
  '/go':'go/index.html','/go/':'go/index.html',
  '/cost-of-living.html':'cost-of-living.html','/cost-of-living':'cost-of-living.html',
  '/truth-oracle.html':'truth-oracle.html',
  '/truth-oracle-field-guide.html':'truth-oracle-field-guide.html','/shop.html':'shop.html','/truth-oracle':'truth-oracle.html',
  '/agent-bridge-job-contract-v1.json':'agent-bridge-job-contract-v1.json','/agent.json':'agent.json','/agent-commerce.json':'agent-commerce.json',
  '/cube.json':'public-resources.json','/economic-loops.json':'public-resources.json','/ecosystem.json':'public-resources.json',
  '/data/economic-pulse.json':'public-research-feed.json',
  '/pulse':'pulse/index.html','/pulse/':'pulse/index.html',
  '/observatory/commerce-graph':'observatory/commerce-graph/index.html','/observatory/commerce-graph/':'observatory/commerce-graph/index.html','/observatory/commerce-graph/commerce-offer.v1.schema.json':'public-resources.json',
  '/.well-known/carbon-forward-schema.json':'.well-known/carbon-forward-schema.json','/schemas/carbon-forward-intent.v1.json':'schemas/carbon-forward-intent.v1.json',
  '/economic':'pulse/index.html','/economic/':'pulse/index.html',
  '/catalog.json':'catalog.json','/surfaces.json':'surfaces.json',
  '/robots.txt':'robots.txt','/sitemap.xml':'sitemap.xml',
  '/quote-comparison':'quote-comparison/index.html','/quote-comparison/':'quote-comparison/index.html','/quote-comparison.html':'quote-comparison.html',
  '/overpaying':'overpaying.html','/overpaying.html':'overpaying.html',
  '/avatar.html':'avatar.html','/avatar':'avatar.html','/phinhaven.html':'phinhaven.html','/phinhaven/':'phinhaven.html','/phinhaven/hotel':'phinhaven/hotel/index.html','/phinhaven/hotel/':'phinhaven/hotel/index.html','/phinhaven/shallows':'phinhaven/shallows/index.html','/phinhaven/shallows/':'phinhaven/shallows/index.html','/account':'account.html','/account/':'account.html','/register':'register.html','/register/':'register.html','/login':'login.html','/login/':'login.html','/mtg-search':'mtg-search.html','/mtg-search/':'mtg-search.html','/mtg-list':'mtg-list.html','/mtg-list/':'mtg-list.html','/mtg-marketplace':'mtg-marketplace.html','/mtg-marketplace/':'mtg-marketplace.html','/mtg-mod':'mtg-mod.html','/mtg-mod/':'mtg-mod.html','/mtg-welcome':'mtg-welcome.html','/mtg-welcome/':'mtg-welcome.html','/toll-road':'toll-road.html','/toll-road/':'toll-road.html'
};
Object.assign(PUBLIC_FILES,{"/777-distribution.html":"777-distribution.html","/a2a-marketplace.html":"marketplace.html","/agent-bridge.html":"agent-bridge.html","/agent-bridge":"agent-bridge.html","/agent-bridge/":"agent-bridge.html","/cube-marketplace.html":"marketplace.html","/evidence-ledger.html":"trust.html","/evidence.html":"trust.html","/ledger.html":"trust.html","/production-verification.html":"trust.html","/money-500000.html":"shop.html","/silo-template.html":"public-resources.json","/silos/":"shop.html","/silos/index.html":"shop.html","/toll-road.html":"shop.html","/toll-booths.html":"shop.html","/marketplace-forward.html":"marketplace.html","/marketplace-pro.html":"marketplace.html","/free.html":"home.html","/offers.html":"shop.html","/hosted-decision-analysis.html":"c2.html","/growth.html":"demand-services.html","/cortex.html":"home.html","/index-black-gold-v1.html":"home.html","/marketplace/order/":"marketplace.html","/marketplace/order/index.html":"marketplace.html","/marketplace/sell/":"marketplace.html","/marketplace/sell/index.html":"marketplace.html","/economicMechanismLibrary.json":"public-resources.json","/evergreen-silo-factory.json":"public-resources.json","/silo-clone-manifest.json":"public-resources.json","/bridge-tolls.json":"public-resources.json","/commerce-roads.json":"public-resources.json","/compute.json":"public-resources.json","/ledger.json":"public-resources.json","/proof.schema.json":"public-resources.json","/money-playbook.json":"public-resources.json","/dream-ledger-manifest.json":"public-resources.json","/dreamledger-sitemap.xml":"sitemap.xml","/data/economic-events-manifest.json":"public-resources.json","/data/procurement-opportunities.json":"public-research-feed.json","/news.json":"public-research-feed.json","/platform.json":"public-resources.json","/api/agent-commerce/toll-probe.json":"public-resources.json","/b2b/catalog.openapi.json":"public-resources.json","/catalog.openapi.json":"public-resources.json","/marketplace/agent-card.json":"public-resources.json","/marketplace/agent.json":"public-resources.json","/toll-road.json":"public-resources.json"});
Object.assign(PUBLIC_FILES,{"/b2b-marketplace.html":"b2b.html","/auctions.html":"marketplace.html","/auto_parts.html":"marketplace.html","/boardgames.html":"marketplace.html","/cameras.html":"marketplace.html","/collectibles.html":"marketplace.html","/computers.html":"marketplace.html","/furniture.html":"marketplace.html","/home_appliances.html":"marketplace.html","/musical_instruments.html":"marketplace.html","/outdoor.html":"marketplace.html","/phones.html":"marketplace.html","/vinyl.html":"marketplace.html","/nz-secondhand/":"marketplace.html","/nz-secondhand/index.html":"marketplace.html","/digital-products/":"shop.html","/digital-products/index.html":"shop.html","/activity.html":"trust.html","/tools.html":"home.html","/start.html":"shop.html","/free.html":"home.html","/offers.html":"shop.html","/hosted-decision-analysis.html":"c2.html","/growth.html":"demand-services.html","/marketplace/order":"marketplace.html","/marketplace/sell":"marketplace.html","/silos/evergreen.html":"shop.html","/silos/construction-subcontractor-quotes.html":"quote-comparison/construction/index.html","/silos/event-vendor-quotes.html":"quote-comparison/hospitality/index.html","/silos/fleet-repair-quotes.html":"quote-comparison/operations/index.html","/silos/freight-quotes.html":"quote-comparison/import/index.html","/silos/it-hardware-quotes.html":"quote-comparison/operations/index.html","/silos/manufacturing-supplier-quotes.html":"quote-comparison/manufacturing/index.html","/silos/marketing-agency-quotes.html":"quote-comparison/operations/index.html","/silos/professional-services-quotes.html":"quote-comparison/operations/index.html","/silos/saas-vendor-quotes.html":"quote-comparison/operations/index.html","/silos/supplier-price-list-comparison.html":"quote-comparison/wholesale/index.html"});
Object.assign(PUBLIC_FILES,{"/rivet/":"b2b.html","/rivet/index.html":"b2b.html","/dreamledger-billboard.html":"billboard.html","/quote-comparison/ecommerce.html":"quote-comparison/ecommerce/index.html","/tools/":"tools/index.html","/tools/index.html":"tools/index.html","/sandbox-tools.html":"tools/index.html"});
Object.assign(PUBLIC_FILES,{"/discord-starter-kit.html":"products/discord-webhook-starter-kit-001/index.html","/tools/nz-seller-profit/":"tools/seller-profit/index.html","/tools/nz-seller-profit/index.html":"tools/seller-profit/index.html"});
Object.assign(PUBLIC_FILES,{
  "/silos/mtg/silo.json":"silos/mtg/silo.json",
  "/data/mtg-catalog.json":"data/mtg-catalog.json",
  "/data/decklists/quintorius.json":"data/decklists/quintorius.json",
  "/data/_catalog-empty.template.json":"data/_catalog-empty.template.json",
  "/assets/mtg-deck-grid.js":"assets/mtg-deck-grid.js",
  "/assets/mtg-deck-grid.css":"assets/mtg-deck-grid.css",
  "/mtg/quintorius-field-historian.html":"mtg/quintorius-field-historian.html",
  "/mtg/master.html":"mtg/master.html"
});
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,s,b,t){if(res.writableEnded)return;res.statusCode=s;if(t)res.setHeader('Content-Type',t);res.end(b)}
function headers(res){
  res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('X-DreamLedger-Storefront','marketplace-v20-mtg-master');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com https://buy.stripe.com");
}
async function proxySwarm(req,res,p){if(!ENGINE_INTERNAL_URL)return send(res,503,'Swarm engine unavailable','text/plain; charset=utf-8');try{const target=ENGINE_INTERNAL_URL+(p.startsWith('/swarm/')?'/api/swarm-100k/'+p.split('/').pop():p);const h={};if(ENGINE_INTERNAL_API_KEY)h['x-api-key']=ENGINE_INTERNAL_API_KEY;const r=await fetch(target,{headers:h});const body=await r.text();res.statusCode=r.status;res.setHeader('Content-Type',r.headers.get('content-type')||'application/json; charset=utf-8');res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return res.end(body);}catch(e){return send(res,502,'Swarm engine unavailable','text/plain; charset=utf-8');}}
async function proxyTollToEngine(req,res,p){
  if(!ENGINE_INTERNAL_URL)return send(res,503,JSON.stringify({error:'toll_engine_unavailable'}),'application/json; charset=utf-8');
  try{
    const chunks=[]; let size=0;
    if(!['GET','HEAD'].includes(req.method)){
      for await(const chunk of req){ size+=chunk.length; if(size>1024*1024)return send(res,413,JSON.stringify({error:'request_too_large'}),'application/json; charset=utf-8'); chunks.push(chunk); }
    }
    const h={'accept':'application/json'};
    for(const name of ['content-type','idempotency-key','x-dreamledger-toll-key'])if(req.headers[name])h[name]=req.headers[name];
    if(ENGINE_INTERNAL_API_KEY)h['x-api-key']=ENGINE_INTERNAL_API_KEY;
    const target=ENGINE_INTERNAL_URL+(req.url||p);
    const upstream=await fetch(target,{method:req.method,headers:h,body:chunks.length?Buffer.concat(chunks):undefined,redirect:'manual'});
    const body=await upstream.arrayBuffer();
    res.statusCode=upstream.status;
    for(const name of ['content-type','cache-control','location','retry-after']){const value=upstream.headers.get(name);if(value)res.setHeader(name,value);}
    return res.end(Buffer.from(body));
  }catch(error){
    console.error(JSON.stringify({toll_engine_proxy_failed:true,path:p,error:String(error&&error.message||error)}));
    return send(res,502,JSON.stringify({error:'toll_engine_unavailable'}),'application/json; charset=utf-8');
  }
}
function serveFile(res,file){
  const safe=path.normalize(path.join(ROOT,file));
  if(!safe.startsWith(ROOT+path.sep) && safe!==ROOT) return send(res,403,'Forbidden','text/plain; charset=utf-8');
  fs.readFile(safe,(err,data)=>{
    if(err) return send(res,404,'Not Found','text/plain; charset=utf-8');
    const ext=path.extname(file).toLowerCase();
    if(ext==='.html')res.setHeader('Cache-Control','no-store');
    send(res,200,data,MIME[ext]||'application/octet-stream');
  });
}
http.createServer(async (req,res)=>{
  headers(res);
  const u=new URL(req.url||'/','http://localhost');
  const p=u.pathname;
  if(req.method==='GET'&&p==='/healthz'){
    return send(res,200,JSON.stringify({ok:true,service:'dreamledger-storefront'}),'application/json; charset=utf-8');
  }
  if(req.method==='GET'&&p==='/version'){
    return send(res,200,JSON.stringify({service:'dreamledger-storefront',status:'ok',commit:COMMIT==='unknown'?null:COMMIT,mtg:'master'}),'application/json; charset=utf-8');
  }
  if(req.method==='GET' && p==='/api/billboard/public'){
    const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
    const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
    res.setHeader('Cache-Control','no-store');
    if(!base||!key) return send(res,503,JSON.stringify({error:'billboard_inventory_unavailable'}),'application/json; charset=utf-8');
    try{
      const upstream=await fetch(base+'/rest/v1/billboard_public?select=*&limit=100',{
        headers:{apikey:key,authorization:'Bearer '+key,accept:'application/json'},
        signal:AbortSignal.timeout(8000)
      });
      if(!upstream.ok)throw new Error('BILLBOARD_VIEW_'+upstream.status);
      const all=await upstream.json();
      if(!Array.isArray(all))throw new Error('BILLBOARD_VIEW_INVALID');
      const https=value=>{try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:null}catch{return null}};
      const items=all.filter(row=>row&&typeof row==='object'&&
          (String(row.status||'').toUpperCase()==='PUBLISHED'||(!('status' in row)&&Boolean(row.published_at))))
        .map(row=>({
          id:String(row.campaign_id||row.id||'').slice(0,80),
          title:String(row.title||row.label||row.billboard_label||'Published tile').slice(0,80),
          market:String(row.market||'NZ').slice(0,20),
          destination_url:https(row.destination_url||row.link),
          image_url:https(row.image_url),
          status:'PUBLISHED'
        }));
      return send(res,200,JSON.stringify({source:'billboard_public',verified_payment_claim:false,count:items.length,items}),'application/json; charset=utf-8');
    }catch(err){
      console.error('BILLBOARD_PUBLIC_READ_FAILURE',String(err.message||err));
      return send(res,503,JSON.stringify({error:'billboard_inventory_unavailable'}),'application/json; charset=utf-8');
    }
  }
  if(req.method==='GET' && (p==='/api/offers' || p==='/api/products')){
    try{
      const catalogue=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json'),'utf8'));
      const source=Array.isArray(catalogue.products)?catalogue.products:[];
      const listed=source.filter(x=>x&&x.status==='published');
      if(p==='/api/products'){
        return send(res,200,JSON.stringify({schema:'dreamledger/products/v1',count:listed.length,products:listed}),'application/json; charset=utf-8');
      }
      return send(res,200,JSON.stringify({schema:'dreamledger/offers/v1',count:listed.length,offers:listed}),'application/json; charset=utf-8');
    }catch(error){ return send(res,500,JSON.stringify({error:'CATALOG_UNAVAILABLE'}),'application/json; charset=utf-8'); }
  }
  if(p.startsWith('/api/toll')||p.startsWith('/toll/')) return proxyTollToEngine(req,res,p);
  if(p.startsWith('/swarm/')||p.startsWith('/api/swarm')) return proxySwarm(req,res,p);
  if(p.startsWith('/api/commercial/') || p==='/api/webhooks/stripe'){
    try{
      const handled=await commercialCell.handle(req,res,p);
      if(handled)return;
    }catch(error){
      return send(res,500,JSON.stringify({error:'commercial_cell_failed'}),'application/json; charset=utf-8');
    }
  }
  if(req.method!=='GET'&&req.method!=='HEAD') return send(res,405,'Method Not Allowed','text/plain; charset=utf-8');
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
