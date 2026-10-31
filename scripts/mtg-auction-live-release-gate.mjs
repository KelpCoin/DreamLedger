#!/usr/bin/env node
// Read-only production release gauntlet. No write, login, bid, payout or checkout calls.
// Never promote CI green to "deployed" without SHA and live API parity.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
function args(argv){
 const pairs={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||!argv[i+1])throw Error('EXPECTED_FLAGS');pairs[argv[i].slice(2)]=argv[i+1]}
 return pairs;
}
const opts=args(process.argv.slice(2));
const origin=opts.origin||'https://dreamledger.org';
const expected=opts.sha||process.env.EXPECTED_MTG_RELEASE_SHA||'';
const out=resolve(opts.output||'mtg-auction-release-proof.json');
if(origin!=='https://dreamledger.org'||!/^[0-9a-f]{40}$/i.test(expected)){
 console.error('RELEASE_GATE_INPUT_INVALID: require --sha <40 hex> and pinned https://dreamledger.org');
 process.exit(2);
}
const evidence={schema:'mtg-auction-live-release-gate/v1',
 observed_at:new Date().toISOString(),origin,expected_sha:expected,checks:[],verdict:'HOLD',
 scope:'read-only: no POST, no checkout, no bids, no payment mutation'};
async function get(name,path,verify){
 const target=new URL(path,origin);
 if(target.origin!==origin)throw Error('UNPINNED_ORIGIN');
 const check={name,path:target.pathname+target.search,result:'FAIL'};
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(target,{method:'GET',cache:'no-store',redirect:'manual',
    headers:{accept:'application/json,text/html'} ,signal:controller.signal});
   check.http_status=response.status;
   if(!response.ok||response.status>=300){check.reason='HTTP_'+response.status;}
   else{
    const raw=await response.text();
    check.body_sha256=createHash('sha256').update(raw).digest('hex');
    const v=verify(raw,response);
    check.result=v.ok?'PASS':'FAIL';check.reason=v.reason;
   }
  } finally {clearTimeout(timer)}
 }catch(err){check.reason=err?.name==='AbortError'?'REQUEST_TIMEOUT':'REQUEST_UNAVAILABLE'}
 evidence.checks.push(check);
}
await get('release_sha_parity','/api/version',raw=>{
 try{
  const d=JSON.parse(raw);const ok=d.commit===expected;
  return {ok,reason:ok?'EXACT_SHA_MATCH':('DEPLOYED_SHA_MISMATCH:'+(d.commit||'unknown'))};
 }catch{return {ok:false,reason:'INVALID_VERSION_JSON'}}
});
await get('auction_page_source','/mtg/auctions/',raw=>{
 const ok=raw.includes('Original card photo')&&raw.includes('Place recorded bid')&&raw.includes('mtg_auction_jwt_v2');
 return {ok,reason:ok?'EXPECTED_AUCTION_CONSOLE_PRESENT':'CONSOLE_NOT_AT_PRODUCTION'};
});
await get('live_verified_catalogue_api','/api/mtg-auction?action=list',raw=>{
 try{
  const d=JSON.parse(raw);
  const ok=d.live===true&&Array.isArray(d.auctions)&&d.auctions.every(a=>a.status==='open'&&typeof a.id==='string');
  return {ok,reason:ok?'STRUCTURED_VERIFIED_AUCTION_DATA':'LIVE_AUCTION_API_NOT_PROVEN'};
 }catch{return {ok:false,reason:'INVALID_AUCTION_JSON'}}
});
// A public gateway must never leak the evidence-upload key as unauthenticated JSON.
// No write request is made.
const unauth={name:'evidence_route_requires_auth',path:'/api/mtg-auction?action=evidence_config',result:'FAIL'};
try{
 const r=await fetch(origin+unauth.path,{method:'GET',redirect:'manual',cache:'no-store'});
 unauth.http_status=r.status;unauth.result=r.status===401?'PASS':'FAIL';
 unauth.reason=r.status===401?'UNAUTHENTICATED_READ_DENIED':'AUTH_BOUNDARY_NOT_CONFIRMED';
}catch{unauth.reason='REQUEST_UNAVAILABLE'}
evidence.checks.push(unauth);
evidence.verdict=evidence.checks.every(x=>x.result==='PASS')?'READ_ONLY_DEPLOYMENT_PARITY_PASS':'HOLD';
const bytes=JSON.stringify(evidence,null,2)+'\n';
await mkdir(dirname(out),{recursive:true});await writeFile(out,bytes,{flag:'w'});
console.log(JSON.stringify({verdict:evidence.verdict,checks:evidence.checks.map(x=>({name:x.name,result:x.result,reason:x.reason})),proof:out}));
process.exitCode=evidence.verdict==='READ_ONLY_DEPLOYMENT_PARITY_PASS'?0:1;
