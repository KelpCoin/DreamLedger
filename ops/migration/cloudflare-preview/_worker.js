/** Cloudflare Pages Advanced Mode preview: static assets + read-only catalog projection.
 * Liveness explicitly reports degraded. Stateful/payment paths remain fail-closed until ported.
 */
const BLOCKED=[/^\/api\/toll(\/|$)/,/^\/api\/commercial(\/|$)/,/^\/api\/webhooks\/stripe\/?$/,/^\/toll(\/|$)/];
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-dreamledger-migration-state':status>=500?'blocked':'preview',...extra}})}
function unavailable(path){return json({schema:'dreamledger/cloudflare-migration-preview/v1',status:'BLOCKED_ROUTE_NOT_MIGRATED',route:path,message:'Stateful/payment handler not ported; this route fails closed.',production_ready:false,revenue_claimed_nzd:0},503)}
async function published(env,request){
 if(!env?.ASSETS||typeof env.ASSETS.fetch!=='function')throw new Error('ASSETS_BINDING_UNAVAILABLE');
 const r=await env.ASSETS.fetch(new Request(new URL('/catalog.json',request.url),{headers:{accept:'application/json'}}));
 if(!r.ok)throw new Error('PUBLIC_CATALOG_HTTP_'+r.status);
 const c=await r.json();if(!c||!Array.isArray(c.products))throw new Error('PUBLIC_CATALOG_INVALID_SHAPE');
 return c.products.filter(p=>p&&p.status==='published');
}
export default {async fetch(request,env){
 const u=new URL(request.url),p=u.pathname;
 if(p==='/healthz'){
  if(!['GET','HEAD'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'GET, HEAD'});
  return json({schema:'dreamledger/cloudflare-preview-health/v1',status:'DEGRADED_STATIC_PREVIEW',live:true,ready:false,checks:{static_assets:Boolean(env?.ASSETS&&typeof env.ASSETS.fetch==='function'),public_catalog:'READ_ONLY_STATIC_PROJECTION',database:'NOT_CONFIGURED_OR_NOT_PROVEN',dynamic_commerce:'BLOCKED_UNTIL_PORTED',stripe_webhook:'BLOCKED_UNTIL_PORTED',engine_proxy:'BLOCKED_UNTIL_PORTED'},production_ready:false,observed_at_utc:new Date().toISOString(),revenue_claimed_nzd:0});
 }
 if(p==='/version'){
  if(!['GET','HEAD'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'GET, HEAD'});
  try {
   if(!env?.ASSETS||typeof env.ASSETS.fetch!=='function')throw new Error('ASSETS_BINDING_UNAVAILABLE');
   const release=await env.ASSETS.fetch(new Request(new URL('/migration-preview-release.json',request.url),{headers:{accept:'application/json'}}));
   if(!release.ok)throw new Error('RELEASE_IDENTITY_HTTP_'+release.status);
   const identity=await release.json();
   const sha=identity?.commit_sha;
   if(identity?.schema!=='dreamledger/cloudflare-preview-release/v1'||typeof sha!=='string'||!/^[a-f0-9]{40}$/i.test(sha))
     throw new Error('INVALID_RELEASE_IDENTITY');
   if(env?.CF_PAGES_COMMIT_SHA && env.CF_PAGES_COMMIT_SHA!==sha)
     throw new Error('DEPLOYMENT_SHA_MISMATCH');
   return json({schema:'dreamledger/cloudflare-preview-version/v1',status:'DEGRADED_STATIC_PREVIEW',commit_sha:sha,branch:env?.CF_PAGES_BRANCH||null,production_ready:false,source:'VERIFIED_BUILD_ARTIFACT',revenue_claimed_nzd:0});
  } catch(e) {
   return json({schema:'dreamledger/cloudflare-preview-version/v1',status:'BLOCKED_RELEASE_IDENTITY',production_ready:false,reason:String(e?.message||'RELEASE_IDENTITY_UNAVAILABLE')},503);
  }
 }
 if(p==='/api/products'||p==='/api/offers'){
  if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED',allowed:['GET']},405,{allow:'GET'});
  try{const products=await published(env,request);return p==='/api/products'?json({schema:'dreamledger/products/v1',count:products.length,products}):json({schema:'dreamledger/offers/v1',count:products.length,offers:products})}
  catch(e){return json({error:'CATALOG_UNAVAILABLE',reason:String(e?.message||'PUBLIC_CATALOG_UNAVAILABLE'),production_ready:false},503)}
 }
 if(BLOCKED.some(re=>re.test(p))||p.startsWith('/api/'))return unavailable(p);
 if(!env?.ASSETS||typeof env.ASSETS.fetch!=='function')return new Response('Static asset binding unavailable',{status:503,headers:{'cache-control':'no-store','x-dreamledger-migration-state':'blocked'}});
 return env.ASSETS.fetch(request);
}};
