'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const site=path.join(root,'compiled','website');
const deployedSite=path.join(root,'..','public');
const required=['index.html','login.html','register.html','account.html','.well-known/agent-commerce.json','.well-known/ucp','truth-oracle.html','truth-oracle.json','transparency-policy.json'];
// Secrets + ops jargon that must never ship on public HTML/JSON surfaces
const forbidden=[
  /api\/ip/i,/api\/control/i,/\/var\/data\//i,/sk_live_/i,/sk_test_/i,/whsec_/i,
  /STRIPE_SECRET_KEY/i,/STRIPE_WEBHOOK_SECRET/i,/DIGITAL_PROXY_APPROVAL_TOKEN/i,
  /LEDGER_DATA_DIR/i,/PROOF_DATA_DIR/i,/DREAMIEZ_DATA_DIR/i,/DEMAND_RADAR_DATA_DIR/i,
  /BEGIN .*PRIVATE KEY/i,/private prompts/i,/internal ledger records/i,
  /FIRST_PAYMENT_PROOF\.json/i,/amplissa/i,/\bBBW\b/i,/big beautiful women/i,/cinema-event-v1/i,
  /\bElohim\b/i,/\bELOHIM\b/i,/\bgauntlet\b/i,/BEC-PRIME/i,/AGENT_BUS/i,/PING_PONG/i,
  /\bfossil\b/i,/evidence_fossil/i,/Settlement spine/i,/settlement_spine/i,
  /Evidence decides/i,/\bMeter:\s*NZ\$/i,/verified_external_revenue/i,
  /\b[c][s]_[a-zA-Z0-9]/i,/fail_closed/i,/fail-closed/i,/figure[- ]eight/i,
  /\bpenstock\b/i,/\bTurbine [ABC]\b/i,/multi-LLM/i,/control plane/i,
  /127\.0\.0\.1/i,/service_role/i,/STRIPE-CHECKOUT-/i
];
const CATALOG_REQUIRED=[
  {label:'DreamLedger', test:/dreamledger/i},
  {label:'Billboard', test:/href=["']\/billboard["']/i},
  {label:'DreamMeez', test:/href=["']\/avatar\.html["']/i},
  {label:'Truth Oracle', test:/href=["']\/truth-oracle\.html["']/i}
];
const errors=[];
for(const rel of required){const p=path.join(site,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)errors.push(`MISSING:${rel}`)}
for(const rel of ['login.html','register.html','account.html']){const p=path.join(site,rel);if(!fs.existsSync(p))continue;const raw=fs.readFileSync(p,'utf8');if(!/\/api\/account\//i.test(raw))errors.push(`ACCOUNT_CONTRACT:${rel}:missing /api/account/`);}
const files=[];const textExtensions=new Set(['.html','.htm','.js','.json','.css','.txt','.xml','.svg','.md','.webmanifest']);const privateImplementationDirs=new Set(['lib','scripts']);const excludedPublicPaths=new Set(['dreamiez','cinema']);const excludedPublicFiles=new Set(['cinema.html']);
function walk(dir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.statSync(p);const rel=path.relative(site,p).replace(/\\/g,'/');const top=rel.split('/')[0];if(s.isDirectory()&&(privateImplementationDirs.has(top)||excludedPublicPaths.has(top)))continue;if(s.isDirectory())walk(p);else if(!excludedPublicFiles.has(rel))files.push(p)}}
if(fs.existsSync(site))walk(site);
// Also scan repo public/ index + agent contracts
for(const rel of ['index.html','agent-commerce.json','agent.json']){
  const p=path.join(deployedSite,rel);
  if(fs.existsSync(p))files.push(p);
}
for(const p of files){const rel=path.relative(root,p).replace(/\\/g,'/');if(!textExtensions.has(path.extname(p).toLowerCase()))continue;const raw=fs.readFileSync(p,'utf8');for(const re of forbidden){if(re.test(raw))errors.push(`PUBLIC_LEAK:${rel}:${re}`)}};
const indexPath=path.join(deployedSite,'index.html');let index='';try{index=fs.readFileSync(indexPath,'utf8')}catch(e){errors.push('CATALOGUE_SURFACE:public/index.html unreadable')}
for(const requiredEntry of CATALOG_REQUIRED){if(!requiredEntry.test.test(index))errors.push(`CATALOGUE_REQUIRED_MISSING:${requiredEntry.label}`)}
const agentPath=path.join(site,'.well-known','agent-commerce.json');let agent={};try{agent=JSON.parse(fs.readFileSync(agentPath,'utf8'))}catch(e){/* optional if path missing */}
if(agent&&Object.keys(agent).length){
  if(agent.private_material!=='excluded'&&agent.private_material!==undefined)errors.push('AGENT_BOUNDARY:private_material');
}
const proof={schema:'dreamledger/public-surface-proof/v16',verdict:errors.length?'FAIL':'PASS',required_files:required,scanned_files:files.map(x=>path.relative(root,x).replace(/\\/g,'/')).sort(),errors,public_boundary:'Customer English only on public HTML/JSON; ops vocabulary blocked'};
fs.mkdirSync(path.join(root,'data','proofs'),{recursive:true});fs.writeFileSync(path.join(root,'data','proofs','PUBLIC-SURFACE-PROOF.json'),JSON.stringify(proof,null,2)+'\n','utf8');console.log(JSON.stringify(proof,null,2));process.exit(errors.length?1:0);
