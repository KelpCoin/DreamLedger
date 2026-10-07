'use strict';
const fs=require('fs');
const crypto=require('crypto');

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const MANIFEST=process.env.EVERGREEN_MANIFEST||`${ROOT}/public/evergreen-silo-factory.json`;
const BLOG=String(process.env.TUMBLR_BLOG_IDENTIFIER||'').trim();
const CONSUMER_KEY=String(process.env.TUMBLR_CONSUMER_KEY||'').trim();
const CONSUMER_SECRET=String(process.env.TUMBLR_CONSUMER_SECRET||'').trim();
const TOKEN=String(process.env.TUMBLR_OAUTH_TOKEN||'').trim();
const TOKEN_SECRET=String(process.env.TUMBLR_OAUTH_TOKEN_SECRET||'').trim();
const PUBLISH=process.argv.includes('--publish');
const LIMIT=Math.max(1,Math.min(20,Number(process.env.TUMBLR_BATCH_SIZE||5)));
const BASE='https://api.tumblr.com';

function enc(v){return encodeURIComponent(String(v)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());}
function nonce(){return crypto.randomBytes(16).toString('hex');}
function oauthHeader(method,url,params){
  const oauth={oauth_consumer_key:CONSUMER_KEY,oauth_nonce:nonce(),oauth_signature_method:'HMAC-SHA1',oauth_timestamp:String(Math.floor(Date.now()/1000)),oauth_token:TOKEN,oauth_version:'1.0'};
  const all={...params,...oauth};
  const pairs=Object.keys(all).sort().map(k=>enc(k)+'='+enc(all[k]));
  const u=new URL(url);
  const baseUrl=u.origin+u.pathname;
  const base=method.toUpperCase()+'&'+enc(baseUrl)+'&'+enc(pairs.join('&'));
  const key=enc(CONSUMER_SECRET)+'&'+enc(TOKEN_SECRET);
  oauth.oauth_signature=crypto.createHmac('sha1',key).update(base).digest('base64');
  return 'OAuth '+Object.keys(oauth).sort().map(k=>enc(k)+'="'+enc(oauth[k])+'"').join(', ');
}

function assertCredentials(){
  if(!BLOG||!CONSUMER_KEY||!CONSUMER_SECRET||!TOKEN||!TOKEN_SECRET){
    throw new Error('Tumblr OAuth configuration required: TUMBLR_BLOG_IDENTIFIER, TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_OAUTH_TOKEN, TUMBLR_OAUTH_TOKEN_SECRET');
  }
}

async function api(path,method='GET',body={}){
  const url=BASE+path;
  const form=new URLSearchParams();
  for(const [k,v] of Object.entries(body)) form.set(k,String(v));
  const params={};
  if(method==='GET') for(const [k,v] of Object.entries(body)) params[k]=v;
  const headers={Accept:'application/json',Authorization:oauthHeader(method,url,params)};
  const opts={method,headers};
  if(method!=='GET'){headers['Content-Type']='application/x-www-form-urlencoded';opts.body=form.toString();}
  const res=await fetch(url,opts);
  const text=await res.text();
  let data={}; try{data=JSON.parse(text||'{}')}catch{}
  if(!res.ok) throw new Error(`Tumblr API ${res.status}: ${data?.meta?.msg||text.slice(0,500)}`);
  return data;
}

function load(){
  const x=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
  const rows=Array.isArray(x.live_adapters)?x.live_adapters:[];
  return rows.filter(x=>x&&x.state==='LIVE_ADAPTER'&&x.slug&&x.name&&x.description&&x.route&&x.checkout_url);
}

function title(row){return `DreamLedger service: ${row.name} [${row.slug}]`;}
function postBody(row){
  const url='https://dreamledger.org'+row.route;
  const description=`${row.description}\n\nLive service surface: ${url}\nCheckout: ${row.checkout_url}\n\nEconomic truth remains UNVERIFIED until an independent settled payment and fulfillment evidence are observed.`;
  return {type:'link',state:'published',title:title(row),url,description,tags:'DreamLedger,automation,procurement,comparison'};
}

async function recentPosts(){
  const data=await api(`/v2/blog/${encodeURIComponent(BLOG)}/posts?api_key=${encodeURIComponent(CONSUMER_KEY)}&limit=20`,'GET');
  return Array.isArray(data?.response?.posts)?data.response.posts:[];
}

async function main(){
  const rows=load();
  if(!rows.length) throw new Error('No LIVE_ADAPTER rows found in evergreen-silo-factory.json');
  console.log(`TUMBLR_ELIGIBLE=${rows.length}`);
  console.log(`TUMBLR_MODE=${PUBLISH?'PUBLISH':'DRY_RUN'}`);
  if(!PUBLISH){for(const row of rows.slice(0,LIMIT)) console.log(JSON.stringify({slug:row.slug,title:title(row),url:'https://dreamledger.org'+row.route,checkout_url:row.checkout_url}));return;}
  assertCredentials();
  const recent=await recentPosts();
  const seen=new Set(recent.map(p=>String(p.title||'')));
  let published=0,skipped=0;
  for(const row of rows){
    if(published>=LIMIT) break;
    const t=title(row);
    if(seen.has(t)){skipped++;continue;}
    const result=await api(`/v2/blog/${encodeURIComponent(BLOG)}/post`,'POST',postBody(row));
    console.log(JSON.stringify({published:true,slug:row.slug,post_id:result?.response?.id||null}));
    published++;
  }
  console.log(JSON.stringify({published,skipped,limit:LIMIT},null,2));
}

main().catch(e=>{console.error(e.stack||e);process.exit(1);});