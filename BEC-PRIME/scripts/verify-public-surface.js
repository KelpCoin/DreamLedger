'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..','..');
const site=path.join(root,'public');
const required=['index.html','billboard.html','mtg.html','avatar.html','server.js','package.json'];
const forbidden=[/api\/ip/i,/api\/control/i,/\/var\/data\//i,/sk_live_/i,/sk_test_/i,/whsec_/i,/STRIPE_SECRET_KEY/i,/STRIPE_WEBHOOK_SECRET/i,/SUPABASE_SERVICE_ROLE_KEY/i,/DIGITAL_PROXY_APPROVAL_TOKEN/i,/LEDGER_DATA_DIR/i,/PROOF_DATA_DIR/i,/DREAMIEZ_DATA_DIR/i,/DEMAND_RADAR_DATA_DIR/i,/BEGIN .*PRIVATE KEY/i,/private prompts/i,/internal ledger records/i,/FIRST_PAYMENT_PROOF\.json/i,/amplissa/i,/\bBBW\b/i,/big beautiful women/i,/cinema-event-v1/i,/Gauntlet/i,/Economic Court/i,/Truth Oracle/i,/ELOHIM/i,/BrownEye Cortex/i,/BEC-PRIME/i,/DreamLogic/i,/CollectorsCoast/i,/HappyHomarid/i];
const requiredText=['DreamLedger','FIND SOMETHING','GOOD.','Commander Deck Diagnostic','DreamMee','NZ$50'];
const errors=[];
for(const rel of required){const p=path.join(site,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)errors.push('MISSING:'+rel)}
const files=[];
const exts=new Set(['.html','.htm','.js','.json','.css','.txt','.xml','.svg','.md','.webmanifest']);
function walk(dir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.statSync(p);if(s.isDirectory())walk(p);else files.push(p)}}
walk(site);
for(const p of files){if(!exts.has(path.extname(p).toLowerCase()))continue;const rel=path.relative(site,p).replace(/\\/g,'/');const raw=fs.readFileSync(p,'utf8');for(const re of forbidden){if(re.test(raw))errors.push('PUBLIC_LEAK:'+rel+':'+re)}} 
let index='';
try{index=fs.readFileSync(path.join(site,'index.html'),'utf8')}catch(e){errors.push('CATALOGUE_SURFACE:index.html unreadable')}
for(const text of requiredText){if(!index.toLowerCase().includes(text.toLowerCase()))errors.push('CATALOGUE_REQUIRED_MISSING:'+text)}
const server=fs.existsSync(path.join(site,'server.js'))?fs.readFileSync(path.join(site,'server.js'),'utf8'):'';
for(const token of ["'/':'index.html'","'/billboard':'billboard.html'","'/mtg':'mtg.html'","'/avatar':'avatar.html'","if(!ALLOWED_API[key])"]){if(!server.includes(token))errors.push('PUBLIC_ROUTE_CONTRACT:'+token)}
const proof={schema:'dreamledger/public-surface-proof/v14',verdict:errors.length?'FAIL':'PASS',required_files:required,scanned_files:files.map(x=>path.relative(site,x).replace(/\\/g,'/')).sort(),excluded_implementation_dirs:[],excluded_surfaces:[],excluded_files:[],binary_assets_skipped:true,errors,public_boundary:'E1 public catalogue doorway; public-v5 is the canonical front door'};
fs.mkdirSync(path.join(root,'BEC-PRIME','data','proofs'),{recursive:true});
fs.writeFileSync(path.join(root,'BEC-PRIME','data','proofs','PUBLIC-SURFACE-PROOF.json'),JSON.stringify(proof,null,2)+'\n','utf8');
console.log(JSON.stringify(proof,null,2));
process.exit(errors.length?1:0);
