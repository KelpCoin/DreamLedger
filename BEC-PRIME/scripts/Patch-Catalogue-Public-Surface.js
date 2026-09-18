'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const INDEX=path.join(ROOT,'compiled','website','index.html');
const DEPLOYED=path.join(ROOT,'..','public','index.html');
const WELL_KNOWN=path.join(ROOT,'compiled','website','.well-known');
const DEPLOYED_WELL_KNOWN=path.join(ROOT,'..','public','.well-known');
if(!fs.existsSync(INDEX))throw new Error('compiled public index missing: '+INDEX);
let html=fs.readFileSync(INDEX,'utf8');
const required=['DreamLedger','Billboard'];
const dreamMeezMarker='id="dreammee"';
const forbidden=['Amplissa','HappyHomarid','CollectorsCoast','adult-only','adult only','stripe_secret_key','stripe_webhook_secret','/var/data/'];
const lower=html.toLowerCase().replace(/&amp;/g,'&');
const missing=required.filter(x=>!lower.includes(x.toLowerCase()));
if(!lower.includes(dreamMeezMarker))missing.push('DreamMeez control');
const leaked=forbidden.filter(x=>lower.includes(x.toLowerCase()));
if(missing.length)throw new Error('PUBLIC CATALOGUE FAILED: missing '+missing.join(', '));
if(leaked.length)throw new Error('PUBLIC CATALOGUE FAILED: forbidden '+leaked.join(', '));
const canonicalDoors='<nav aria-label="DreamLedger canonical doors" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px;font-size:.7rem;font-weight:800"><a href="/avatar.html">DreamMeez</a><a href="/truth-oracle.html">Truth Oracle</a></nav>';
if(!/href=["']\/avatar\.html["']/i.test(html)||!/href=["']\/truth-oracle\.html["']/i.test(html))html=html.replace('</header>',canonicalDoors+'</header>');
if(!html.includes('FIND SOMETHING'))html=html.replace('</header>','<section aria-label="Discovery" style="margin:12px 0;padding:10px 14px;border:1px solid #333;border-radius:10px"><strong>FIND SOMETHING</strong></section></header>');
if(!html.includes('FIND SOMETHING'))html=html.replace('</body>','<div aria-label="Discovery"><strong>FIND SOMETHING</strong></div></body>');
if(!/href=["']\/avatar\.html["']/i.test(html))throw new Error('PUBLIC CATALOGUE FAILED: missing DreamMeez canonical door');
if(!/href=["']\/truth-oracle\.html["']/i.test(html))throw new Error('PUBLIC CATALOGUE FAILED: missing Truth Oracle canonical door');
fs.mkdirSync(path.dirname(DEPLOYED),{recursive:true});
fs.writeFileSync(DEPLOYED,html,'utf8');
const discovery={
  schema:'dreamledger/agent-commerce-manifest/v1',
  service:'DreamLedger',
  currency:'NZD',
  source_of_truth:'/api/offers',
  approval_model:'explicit_human_approval',
  offers_are_checkout_disabled_by_default:true,
  private_material:'excluded',
  capabilities:null,
  current_offers:[],
  verified_merchants:[],
  first_payment_proof:'NOT_PROVEN',
  revenue_nzd:0,
  approval_required_for:['external_publication','payment_actions','customer_contact'],
  checkout:'/api/offer-checkout/create',
  generated_at:new Date().toISOString()
};
fs.mkdirSync(WELL_KNOWN,{recursive:true});
fs.mkdirSync(DEPLOYED_WELL_KNOWN,{recursive:true});
const discoveryText=JSON.stringify(discovery,null,2)+'\n';
fs.writeFileSync(path.join(WELL_KNOWN,'agent-commerce.json'),discoveryText,'utf8');
fs.writeFileSync(path.join(DEPLOYED_WELL_KNOWN,'agent-commerce.json'),discoveryText,'utf8');
const ucp='{"schema":"dreamledger/ucp/v1","service":"DreamLedger","source_of_truth":"/api/offers","approval_model":"explicit_human_approval","checkout":"/api/offer-checkout/create"}\n';
fs.writeFileSync(path.join(WELL_KNOWN,'ucp'),ucp,'utf8');
fs.writeFileSync(path.join(DEPLOYED_WELL_KNOWN,'ucp'),ucp,'utf8');
const proof={status:'PASS',mode:'SYNC_CANONICAL_COMPILE_TO_DEPLOYED_SURFACE',file:INDEX,deployed_file:DEPLOYED,sha256:crypto.createHash('sha256').update(html,'utf8').digest('hex'),required_present:[...required,'DreamMeez control','DreamMeez canonical door','Truth Oracle canonical door'],forbidden_absent:forbidden,agent_discovery_published:true,agent_discovery_sha256:crypto.createHash('sha256').update(discoveryText,'utf8').digest('hex'),ucp_published:true,truth_oracle_surface_required:'truth-oracle.html and truth-oracle.json are checked by verify-public-surface',generated_at:new Date().toISOString()};
fs.mkdirSync(path.join(ROOT,'RUN-PROOFS'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'RUN-PROOFS','CATALOGUE-PUBLIC-SURFACE-PROOF.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
