'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const site=path.join(root,'compiled','website');
const siloRoot=path.join(root,'compiled');
const required=['index.html','dreamiez.html','assets/public-marketplace.js','assets/dreamiez-account.js','.well-known/agent-commerce.json','.well-known/ucp'];
const siloDirs=['mtg','dreamiez'];
const forbidden=[/api\/ip/i,/catalog\/ip-capabilities\.json/i,/sk_live_/i,/sk_test_/i,/whsec_/i,/BEGIN .*PRIVATE KEY/i,/private prompts/i,/gauntlet rules/i,/internal ledger records/i];
const errors=[];
for(const rel of required){const p=path.join(site,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)errors.push(`MISSING:${rel}`);}
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.statSync(p);if(s.isDirectory())walk(p);else files.push(p);}}
walk(site);
for(const silo of siloDirs){const dir=path.join(siloRoot,silo);if(!fs.existsSync(path.join(dir,'index.html')))errors.push(`MISSING_SILO:${silo}/index.html`);if(!fs.existsSync(path.join(dir,'manifest.json')))errors.push(`MISSING_SILO:${silo}/manifest.json`);walk(dir);}
for(const p of files){const raw=fs.readFileSync(p,'utf8');for(const re of forbidden){if(re.test(raw))errors.push(`PUBLIC_LEAK:${path.relative(root,p)}:${re}`)}}
const index=fs.existsSync(path.join(site,'index.html'))?fs.readFileSync(path.join(site,'index.html'),'utf8'):'';
const agentFile=path.join(site,'.well-known','agent-commerce.json');
let agent={};try{agent=JSON.parse(fs.readFileSync(agentFile,'utf8'));}catch{errors.push('INVALID:agent-commerce.json');}
if(!index.includes('Create your Dreamiez'))errors.push('MISSING:Dreamiez CTA');
if(!index.includes('public-marketplace.js'))errors.push('MISSING:marketplace runtime');
if(agent.private_material!=='excluded')errors.push('AGENT_BOUNDARY:private_material');
if(agent.capabilities!==null)errors.push('AGENT_BOUNDARY:capabilities must remain null');
for(const silo of siloDirs){const manifest=JSON.parse(fs.readFileSync(path.join(siloRoot,silo,'manifest.json'),'utf8'));if(manifest.silo_id!==silo)errors.push(`SILO_ID_MISMATCH:${silo}`);if(manifest.checkout_unlocked!==false)errors.push(`SILO_CHECKOUT_UNLOCKED:${silo}`);if(manifest.payment_claimed!==false)errors.push(`SILO_PAYMENT_CLAIMED:${silo}`);if(manifest.private_material_excluded!==true)errors.push(`SILO_PRIVATE_BOUNDARY:${silo}`);}
const proof={schema:'dreamledger/public-surface-proof/v2',verdict:errors.length?'FAIL':'PASS',required_files:required,scanned_silos:siloDirs,scanned_files:files.map(x=>path.relative(root,x)).sort(),errors,public_boundary:'customer outcomes and machine discovery only; internal implementation doctrine excluded'};
fs.mkdirSync(path.join(root,'data','proofs'),{recursive:true});
fs.writeFileSync(path.join(root,'data','proofs','PUBLIC-SURFACE-PROOF.json'),JSON.stringify(proof,null,2)+'\n','utf8');
console.log(JSON.stringify(proof,null,2));
process.exit(errors.length?1:0);
