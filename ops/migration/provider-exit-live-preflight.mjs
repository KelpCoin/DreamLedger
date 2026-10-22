#!/usr/bin/env node
// Read-only authenticated inventory. No production writes. Missing access = BLOCKED.
import fs from 'node:fs';
import path from 'node:path';
const e=process.env, out=e.PROVIDER_EXIT_PROOF_PATH||'proof/migration/provider-exit-live-preflight.json';
const state={schema:'dreamledger/provider-exit-live-preflight/v1',at:new Date().toISOString(),sha:e.GITHUB_SHA||null,mode:'READ_ONLY',provider_mutations:false,stripe_mutations:false,status:'BLOCKED',checks:{}};
async function get(url,headers){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),11000);
 try{const r=await fetch(url,{method:'GET',headers,redirect:'manual',signal:ctl.signal});
  if(!r.ok)return {ok:false,http_status:r.status};
  try{return {ok:true,data:await r.json(),http_status:r.status}}catch{return {ok:false,http_status:r.status}}}
 catch(ex){return {ok:false,error_class:ex?.name||'FetchError'}}finally{clearTimeout(timer)}
}
function set(k,v){state.checks[k]=v}
function unavailable(k){set(k,{observed:false,status:'BLOCKED_MISSING_ACCESS'})}
async function stripe(){
 if(!e.STRIPE_SECRET_KEY)return unavailable('stripe');
 const auth='Basic '+Buffer.from(e.STRIPE_SECRET_KEY+':').toString('base64');
 const r=await get('https://api.stripe.com/v1/webhook_endpoints?limit=100',{Authorization:auth});
 if(!r.ok||!Array.isArray(r.data?.data))return set('stripe',{observed:false,status:'BLOCKED_API_READ',http_status:r.http_status||0});
 const a=r.data.data, legacy=a.filter(x=>x.status==='enabled'&&/(\.onrender\.com|\.supabase\.co)(\/|$)/i.test(String(x.url||'')));
 set('stripe',{observed:!r.data.has_more,status:r.data.has_more?'BLOCKED_TRUNCATION':'OBSERVED',webhook_count:a.length,enabled_legacy_webhooks:legacy.length,legacy_hosts:[...new Set(legacy.map(x=>new URL(x.url).hostname))]});
}
async function render(){
 if(!e.RENDER_API_KEY)return unavailable('render');
 const r=await get('https://api.render.com/v1/services?limit=100',{Authorization:'Bearer '+e.RENDER_API_KEY});
 if(!r.ok||!Array.isArray(r.data))return set('render',{observed:false,status:'BLOCKED_API_READ',http_status:r.http_status||0});
 const a=r.data.map(x=>x?.service||x);
 if(a.some(x=>typeof x.id!=='string'))return set('render',{observed:false,status:'BLOCKED_UNKNOWN_RESPONSE_SHAPE'});
 set('render',{observed:a.length<100,status:a.length===100?'BLOCKED_TRUNCATION':'OBSERVED',total:a.length,unsuspended:a.filter(x=>x.suspended==='not_suspended').length});
}
async function supabase(){
 if(!e.SUPABASE_ACCESS_TOKEN)return unavailable('supabase');
 const h={Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN},r=await get('https://api.supabase.com/v1/projects',h);
 if(!r.ok||!Array.isArray(r.data))return set('supabase',{observed:false,status:'BLOCKED_API_READ',http_status:r.http_status||0});
 const project=r.data.find(x=>x.id===(e.SUPABASE_PROJECT_REF||'wbwgroygjeyukkspnqiy'));
 set('supabase',{observed:true,status:'OBSERVED',total_projects:r.data.length,active_projects:r.data.filter(x=>String(x.status||'').startsWith('ACTIVE')).length,original_project_exists:!!project});
}
async function neon(){
 if(!e.NEON_API_KEY||!e.NEON_PROJECT_ID)return unavailable('neon');
 const r=await get('https://console.neon.tech/api/v2/projects/'+encodeURIComponent(e.NEON_PROJECT_ID),{Authorization:'Bearer '+e.NEON_API_KEY});
 set('neon',{observed:!!(r.ok&&r.data?.project),status:r.ok?'PROJECT_READABLE':'BLOCKED_API_READ',source_data_reconciled:false});
}
async function cloudflare(){
 if(!e.CLOUDFLARE_API_TOKEN||!e.CLOUDFLARE_ACCOUNT_ID||!e.CLOUDFLARE_PAGES_PROJECT)return unavailable('cloudflare');
 const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(e.CLOUDFLARE_ACCOUNT_ID)+'/pages/projects/'+encodeURIComponent(e.CLOUDFLARE_PAGES_PROJECT);
 const r=await get(url,{Authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN});
 set('cloudflare',{observed:!!(r.ok&&r.data?.success!==false),status:r.ok?'PROJECT_READABLE':'BLOCKED_API_READ',dynamic_routes_accepted:false});
}
if(process.argv.includes('--self-test')) {
 if(!/\.onrender\.com/.test('dreamledger1.onrender.com'))throw Error('Self test failed');
 console.log('PROVIDER_EXIT_SELF_TEST_PASS');process.exit(0);
}
await Promise.allSettled([stripe(),render(),supabase(),neon(),cloudflare()]);
const a=state.checks;
state.gates={no_render_services:a.render?.observed===true&&a.render.total===0,no_supabase_projects:a.supabase?.observed===true&&a.supabase.total_projects===0,no_live_legacy_webhooks:a.stripe?.observed===true&&a.stripe.enabled_legacy_webhooks===0,neon_data_reconciled:false,cloudflare_dynamic_routes_proven:false,live_signed_webhook_and_delivery_proven:false};
state.status='BLOCKED_SOURCE_DATA_AND_PRODUCTION_ACCEPTANCE_NOT_PROVEN';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(state,null,2)+'\n',{encoding:'utf8',mode:0o600});
console.log(JSON.stringify({status:state.status,checks:state.checks,gates:state.gates,proof:out},null,2));
process.exitCode=2; // Never claim full production migration from provider GET requests.
