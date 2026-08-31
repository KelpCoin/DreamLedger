'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const site=path.join(root,'compiled','website');
const deployedSite=path.join(root,'..','public');
const required=['index.html','login.html','register.html','account.html','.well-known/agent-commerce.json','.well-known/ucp','truth-oracle.html','truth-oracle.json','transparency-policy.json'];
const forbidden=[
  /api\/ip/i,/api\/control/i,/\/var\/data\//i,/sk_live_/i,/sk_test_/i,/whsec_/i,
  /STRIPE_SECRET_KEY/i,/STRIPE_WEBHOOK_SECRET/i,/DIGITAL_PROXY_APPROVAL_TOKEN/i,
  /LEDGER_DATA_DIR/i,/PROOF_DATA_DIR/i,/DREAMIEZ_DATA_DIR/i,/DEMAND_RADAR_DATA_DIR/i,
  /BEGIN .*PRIVATE KEY/i,/private prompts/i,/internal ledger records/i,
  /FIRST_PAYMENT_PROOF\.json/i,/amplissa/i,/\bBBW\b/i,/big beautiful women/i,
  /cinema-event-v1/i
];
const CATALOG_REQUIRED=['DreamLedger','Digital products','Magic & collectibles','Games & experiments','Digital media'];
const errors=[];
for(const rel of required){const p=path.join(site,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)errors.push(`MISSING:${rel}`)}
const authPages=['login.html','register.html','account.html'];
for(const rel of authPages){const p=path.join(site,rel);if(!fs.existsSync(p))continue;const raw=fs.readFileSync(p,'utf8');if(!/\/api\/account\//i.test(raw))errors.push(`ACCOUNT_CONTRACT:${rel}:missing /api/account/`);}
const files=[];
const textExtensions=new Set(['.html','.htm','.js','.json','.css','.txt','.xml','.svg','.md','.webmanifest']);
const privateImplementationDirs=new Set(['lib','scripts']);
const excludedPublicPaths=new Set(['dreamiez','cinema']);
const excludedPublicFiles=new Set(['cinema.html']);
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const name of fs.readdirSync(dir)){
    const p=path.join(dir,name);const s=fs.statSync(p);const rel=path.relative(site,p).replace(/\\/g,'/');const top=rel.split('/')[0];
    if(s.isDirectory()&&(privateImplementationDirs.has(top)||excludedPublicPaths.has(top)))continue;
    if(s.isDirectory())walk(p);else if(!excludedPublicFiles.has(rel))files.push(p);
  }
}
if(fs.existsSync(site))walk(site);
for(const p of files){
  const rel=path.relative(site,p).replace(/\\/g,'/');
  if(!textExtensions.has(path.extname(p).toLowerCase()))continue;
  const raw=fs.readFileSync(p,'utf8');
  for(const re of forbidden){if(re.test(raw))errors.push(`PUBLIC_LEAK:${rel}:${re}`)}
}
const indexPath=path.join(deployedSite,'index.html');
let index='';
try{index=fs.readFileSync(indexPath,'utf8')}catch(e){errors.push('CATALOGUE_SURFACE:public/index.html unreadable')}
for(const requiredText of CATALOG_REQUIRED){if(!index.toLowerCase().includes(requiredText.toLowerCase()))errors.push(`CATALOGUE_REQUIRED_MISSING:${requiredText}`)}
const agentPath=path.join(site,'.well-known','agent-commerce.json');
let agent={};
try{agent=JSON.parse(fs.readFileSync(agentPath,'utf8'))}catch(e){errors.push('AGENT_BOUNDARY:invalid agent-commerce.json')}
if(agent.private_material!=='excluded')errors.push('AGENT_BOUNDARY:private_material');
if(agent.capabilities!==null)errors.push('AGENT_BOUNDARY:capabilities must remain null');
if(!Array.isArray(agent.current_offers)||agent.current_offers.length!==0)errors.push('AGENT_BOUNDARY:current_offers must remain empty');
const proof={schema:'dreamledger/public-surface-proof/v14',verdict:errors.length?'FAIL':'PASS',required_files:required,scanned_files:files.map(x=>path.relative(site,x).replace(/\\/g,'/')).sort(),excluded_implementation_dirs:Array.from(privateImplementationDirs).sort(),excluded_surfaces:Array.from(excludedPublicPaths).sort(),excluded_files:Array.from(excludedPublicFiles).sort(),binary_assets_skipped:true,errors,public_boundary:'E1 public catalogue doorway; isolated legacy and private implementation surfaces are not the public front door'};
fs.mkdirSync(path.join(root,'data','proofs'),{recursive:true});
fs.writeFileSync(path.join(root,'data','proofs','PUBLIC-SURFACE-PROOF.json'),JSON.stringify(proof,null,2)+'\n','utf8');
console.log(JSON.stringify(proof,null,2));
process.exit(errors.length?1:0);
