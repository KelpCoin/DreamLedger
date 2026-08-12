'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const site=path.join(root,'compiled','website');
const required=['index.html','dreamiez.html','assets/public-marketplace.js','assets/dreamiez-account.js','.well-known/agent-commerce.json','.well-known/ucp'];
const forbidden=[
  /api\/ip/i,
  /api\/control/i,
  /catalog\//i,
  /BEC-PRIME/i,
  /OFFER-BEC-PRIME/i,
  /\/var\/data\//i,
  /sk_live_/i,
  /sk_test_/i,
  /whsec_/i,
  /STRIPE_SECRET_KEY/i,
  /STRIPE_WEBHOOK_SECRET/i,
  /DIGITAL_PROXY_APPROVAL_TOKEN/i,
  /LEDGER_DATA_DIR/i,
  /PROOF_DATA_DIR/i,
  /DREAMIEZ_DATA_DIR/i,
  /DEMAND_RADAR_DATA_DIR/i,
  /BEGIN .*PRIVATE KEY/i,
  /private prompts/i,
  /gauntlet rules/i,
  /internal ledger records/i,
  /FIRST_PAYMENT_PROOF\.json/i
];
const errors=[];
for(const rel of required){const p=path.join(site,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)errors.push(`MISSING:${rel}`);}
const files=[];
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.statSync(p);if(s.isDirectory())walk(p);else files.push(p)}}
if(fs.existsSync(site))walk(site);
for(const p of files){const raw=fs.readFileSync(p,'utf8');for(const re of forbidden){if(re.test(raw))errors.push(`PUBLIC_LEAK:${path.relative(site,p)}:${re}`)}}
const index=fs.existsSync(path.join(site,'index.html'))?fs.readFileSync(path.join(site,'index.html'),'utf8'):'';
const agentPath=path.join(site,'.well-known','agent-commerce.json');
const agent=fs.existsSync(agentPath)?JSON.parse(fs.readFileSync(agentPath,'utf8')):{};
if(!index.includes('public-marketplace.js'))errors.push('MISSING:marketplace runtime');
if(agent.private_material!=='excluded')errors.push('AGENT_BOUNDARY:private_material');
if(agent.capabilities!==null)errors.push('AGENT_BOUNDARY:capabilities must remain null');
if(!Array.isArray(agent.current_offers)||agent.current_offers.length!==0)errors.push('AGENT_BOUNDARY:current_offers must remain empty');
const proof={schema:'dreamledger/public-surface-proof/v2',verdict:errors.length?'FAIL':'PASS',required_files:required,scanned_files:files.map(x=>path.relative(site,x)).sort(),errors,public_boundary:'customer outcomes and machine discovery only; secrets, internal controls, implementation doctrine and private operational material excluded'};
fs.writeFileSync(path.join(root,'data','proofs','PUBLIC-SURFACE-PROOF.json'),JSON.stringify(proof,null,2)+'\n','utf8');
console.log(JSON.stringify(proof,null,2));
process.exit(errors.length?1:0);
