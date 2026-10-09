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
  '/':'home.html','/index.html':'home.html',
  '/about':'about.html','/about/':'about.html','/trust':'trust.html','/trust/':'trust.html',
  '/catalogue':'catalogue.html','/catalogue/':'catalogue.html','/catalogue.html':'catalogue.html',
  '/app.js':'app.js',
  '/sell.html':'sell.html','/sell':'sell.html','/sell/':'sell.html',
  '/billboard':'billboard.html','/billboard/':'billboard.html','/billboard.html':'billboard.html',
  '/mtg':'mtg/index.html','/mtg/':'mtg/index.html','/mtg.html':'mtg/index.html',
  '/demand-services':'demand-services.html','/demand-services/':'demand-services.html',
  '/fightedge':'fightedge/index.html','/fightedge/':'fightedge/index.html',
  '/commander-guide':'commander-guide.html','/commander-guide/':'commander-guide.html',
  '/agent-commerce':'agent-commerce.html','/agent-commerce/':'agent-commerce.html','/agentic-commerce':'agentic-commerce.html','/agentic-commerce/':'agentic-commerce.html','/revenue.html':'agentic-commerce.html','/revenue':'agentic-commerce.html',
  '/b2b':'b2b.html','/b2b/':'b2b.html','/b2b.html':'b2b.html',
  '/marketplace':'marketplace.html','/marketplace/':'marketplace.html','/marketplace.html':'marketplace.html',
  '/go':'marketplace.html','/go/':'marketplace.html',
  '/cost-of-living.html':'cost-of-living.html','/cost-of-living':'cost-of-living.html',
  '/truth-oracle.html':'truth-oracle.html','/truth-oracle':'truth-oracle.html',
  '/agent.json':'agent.json','/agent-commerce.json':'agent-commerce.json',
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
  '/avatar.html':'avatar.html','/avatar':'avatar.html','/account':'account.html','/account/':'account.html','/register':'register.html','/register/':'register.html','/login':'login.html','/login/':'login.html','/mtg-search':'mtg-search.html','/mtg-search/':'mtg-search.html','/mtg-list':'mtg-list.html','/mtg-list/':'mtg-list.html','/mtg-marketplace':'mtg-marketplace.html','/mtg-marketplace/':'mtg-marketplace.html','/mtg-mod':'mtg-mod.html','/mtg-mod/':'mtg-mod.html','/mtg-welcome':'mtg-welcome.html','/mtg-welcome/':'mtg-welcome.html','/toll-road':'toll-road.html','/toll-road/':'toll-road.html'
};
Object.assign(PUBLIC_FILES,{"/777-distribution.html":"public-resources.json","/a2a-marketplace.html":"marketplace.html","/agent-bridge.html":"agentic-commerce.html","/cube-marketplace.html":"marketplace.html","/evidence-ledger.html":"trust.html","/evidence.html":"trust.html","/ledger.html":"trust.html","/production-verification.html":"trust.html","/money-500000.html":"shop.html","/silo-template.html":"public-resources.json","/silos/":"shop.html","/silos/index.html":"shop.html","/toll-road.html":"shop.html","/toll-booths.html":"shop.html","/marketplace-forward.html":"marketplace.html","/marketplace-pro.html":"marketplace.html","/free.html":"home.html","/offers.html":"shop.html","/hosted-decision-analysis.html":"c2.html","/growth.html":"demand-services.html","/cortex.html":"home.html","/index-black-gold-v1.html":"home.html","/marketplace/order/":"marketplace.html","/marketplace/order/index.html":"marketplace.html","/marketplace/sell/":"marketplace.html","/marketplace/sell/index.html":"marketplace.html","/economicMechanismLibrary.json":"public-resources.json","/evergreen-silo-factory.json":"public-resources.json","/silo-clone-manifest.json":"public-resources.json","/bridge-tolls.json":"public-resources.json","/commerce-roads.json":"public-resources.json","/compute.json":"public-resources.json","/ledger.json":"public-resources.json","/proof.schema.json":"public-resources.json","/money-playbook.json":"public-resources.json","/dream-ledger-manifest.json":"public-resources.json","/dreamledger-sitemap.xml":"sitemap.xml","/data/economic-events-manifest.json":"public-resources.json","/data/procurement-opportunities.json":"public-research-feed.json","/news.json":"public-research-feed.json","/platform.json":"public-resources.json","/api/agent-commerce/toll-probe.json":"public-resources.json","/b2b/catalog.openapi.json":"public-resources.json","/catalog.openapi.json":"public-resources.json","/marketplace/agent-card.json":"public-resources.json","/marketplace/agent.json":"public-resources.json","/toll-road.json":"public-resources.json"});
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
async function proxyFightEdge(req,res,u){
  if(req.method!=='GET'&&req.method!=='HEAD') return send(res,405,'Method Not Allowed','text/plain; charset=utf-8');
  const suffix=u.pathname.replace(/^\/fightedge/,'')||'/';
  const target='https://fightedge-web-live.onrender.com'+suffix+u.search;
  try{
    const upstream=await fetch(target,{method:req.method,headers:{accept:req.headers.accept||'*/*','user-agent':'DreamLedger-FightEdge-Proxy'},redirect:'manual'});
    const type=upstream.headers.get('content-type')||'application/octet-stream';
    let body=req.method==='HEAD'?'':await upstream.text();
    if(type.includes('text/html')){
      body=body.replace(/(href|src|action)=(["'])\/(?!\/)/gi,'$1=$2/fightedge/');
      body=body.replace(/url\((["']?)\/(?!\/)/gi,'url($1/fightedge/');
    }
    res.statusCode=upstream.status;
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control',upstream.headers.get('cache-control')||'no-store');
    res.setHeader('X-DreamLedger-FightEdge-Proxy','canonical');
    return res.end(body);
  }catch(error){
    return send(res,502,JSON.stringify({error:'FIGHTEDGE_UPSTREAM_UNAVAILABLE',message:'The canonical FightEdge service could not be reached.'}),'application/json; charset=utf-8');
  }
}
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
  if((req.method==='GET'||req.method==='HEAD')&&(p==='/fightedge'||p.startsWith('/fightedge/'))){return proxyFightEdge(req,res,u);}
  if(req.method==='GET'&&p==='/healthz'){
    return send(res,200,JSON.stringify({ok:true,service:'dreamledger-storefront'}),'application/json; charset=utf-8');
  }
  if(req.method==='GET'&&p==='/version'){
    return send(res,200,JSON.stringify({service:'dreamledger-storefront',status:'ok'}),'application/json; charset=utf-8');
  }
  if(req.method==='GET' && (p==='/api/offers' || p==='/api/products')){
    try{
      const catalogue=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json'),'utf8'));
      const source=Array.isArray(catalogue.products)?catalogue.products:[];
      const categoryMap={mtg:'mtg','media':'public-placements','public-placements':'public-placements','dreammeez':'avatar-accessories','avatar-accessories':'avatar-accessories','commerce':'digital-tools','digital-tools':'digital-tools','seller_tools':'seller-services','seller-services':'seller-services','kelplantis':'digital-experiences','digital-experiences':'digital-experiences','research':'research-services','research-services':'research-services','procurement':'procurement-tools','procurement-tools':'procurement-tools','toll-booths':'digital-tools','demand-services':'growth-services','growth-services':'growth-services',other:'other-products','other-products':'other-products'};
      const publicDescription=value=>String(value||'').replace(/777/gi,'research').replace(/CUBE/gi,'').replace(/BECK/gi,'').replace(/Elohim/gi,'DreamLedger').replace(/AgentBridge/gi,'the service').replace(/existing fulfillment rail/gi,'automated service').replace(/internal activity/gi,'unverified activity').replace(/economic loops/gi,'purchase steps').replace(/silos?/gi,'categories').trim();
      const listed=source.filter(x=>x&&x.status==='published'&&x.checkout_available===true&&typeof x.checkout_url==='string').map(x=>({
        id:x.id,product_id:x.id,sku:x.sku||null,name:x.name,description:publicDescription(x.description),
        price:x.price,price_nzd:x.currency==='nzd'?x.price:null,currency:x.currency||'nzd',
        category:categoryMap[String(x.category||x.silo||'other').toLowerCase()]||'other-products',
        checkout_url:x.checkout_url,status:'LISTED'
      }));
      if(p==='/api/products'){
        const products=listed.map(x=>({id:x.id,sku:x.sku,name:x.name,description:x.description,price:x.price,currency:x.currency,category:x.category,status:'published',checkout_available:true,checkout_url:x.checkout_url}));
        return send(res,200,JSON.stringify({schema:'dreamledger/products/v1',count:products.length,products,note:'Review the product page for current terms and availability.'}),'application/json; charset=utf-8');
      }
      return send(res,200,JSON.stringify({schema:'dreamledger/offers/v1',count:listed.length,offers:listed,note:'A listing does not prove a completed purchase or delivery.'}),'application/json; charset=utf-8');
    }catch(error){ return send(res,500,JSON.stringify({error:'CATALOG_UNAVAILABLE'}),'application/json; charset=utf-8'); }
  }
  if(req.method==='GET' && (p==='/.well-known/ai'||p==='/.well-known/ai-catalog.json')){
    const file=p==='/.well-known/ai' ? '.well-known/ai' : '.well-known/ai-catalog.json';
    return serveFile(res,file);
  }
  if(req.method==='GET' && (p==='/buy/QUOTE-COMPARE-49'||p==='/buy/quote_compare_49')){
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
  if(req.method==='GET'&&p==='/api/toll/v1/manifest'){
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    return send(res,200,JSON.stringify({
      schema:'dreamledger/public-resources/v1',
      name:'DreamLedger',
      note:'This address no longer lists internal service routes. Use the public product pages for current descriptions, prices, and availability.',
      resources:[
        {name:'Free Truth Oracle',url:'https://dreamledger.org/truth-oracle.html'},
        {name:'Supplier quote comparison',url:'https://dreamledger.org/quote-comparison/'},
        {name:'Products and services',url:'https://dreamledger.org/shop.html'},
        {name:'Public research notes',url:'https://dreamledger.org/pulse/'}
      ]
    }),'application/json; charset=utf-8');
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
  if(/^\/(?:server\.js|package(?:-lock)?\.json|Sync-BECPrimeStorefront\.js|(?:discordCommerce|agentbridge|webhook-proxy|hypothesisCommerce|brand|qrSurface)-preload\.js|PRODUCTION-DEPLOY-TRIGGER-[^/]+|WORKLOG-[^/]+|\.economic-rail-repair[^/]*|mtg-conversion-note\.txt|launch-story\.txt|silos\/cube-http-proof\.txt|rivet\/README\.md|\.env(?:\..*)?)$/i.test(p))return send(res,404,'Not Found','text/plain; charset=utf-8');
  if(['/cube.json','/economic-loops.json','/ecosystem.json','/data/economic-pulse.json','/observatory/commerce-graph/commerce-offer.v1.schema.json',"/777-distribution.html","/a2a-marketplace.html","/agent-bridge.html","/cube-marketplace.html","/evidence-ledger.html","/evidence.html","/ledger.html","/production-verification.html","/money-500000.html","/silo-template.html","/silos/","/silos/index.html","/toll-road.html","/toll-booths.html","/marketplace-forward.html","/marketplace-pro.html","/free.html","/offers.html","/hosted-decision-analysis.html","/growth.html","/cortex.html","/index-black-gold-v1.html","/marketplace/order/","/marketplace/order/index.html","/marketplace/sell/","/marketplace/sell/index.html","/economicMechanismLibrary.json","/evergreen-silo-factory.json","/silo-clone-manifest.json","/bridge-tolls.json","/commerce-roads.json","/compute.json","/ledger.json","/proof.schema.json","/money-playbook.json","/dream-ledger-manifest.json","/dreamledger-sitemap.xml","/data/economic-events-manifest.json","/data/procurement-opportunities.json","/news.json","/platform.json","/api/agent-commerce/toll-probe.json","/b2b/catalog.openapi.json","/catalog.openapi.json","/marketplace/agent-card.json","/marketplace/agent.json","/toll-road.json"].includes(p))res.setHeader('X-Robots-Tag','noindex, nofollow');
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
