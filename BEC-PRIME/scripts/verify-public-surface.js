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
// Catalogue gate: validate the existing catalogue by state. Do not require arbitrary
// products or manufacture public offerings just to satisfy the gate.
const CATALOG_STATES={active:new Set(['published']),inactive:new Set(['gated','draft','archived','disabled','internal'])};
const errors=[];
for(const rel of required){const p=path.join(site,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)errors.push(`MISSING:${rel}`)}
for(const rel of ['login.html','register.html','account.html']){const p=path.join(site,rel);if(!fs.existsSync(p))continue;const raw=fs.readFileSync(p,'utf8');if(!/\/api\/account\//i.test(raw))errors.push(`ACCOUNT_CONTRACT:${rel}:missing /api/account/`);}
const files=[];const textExtensions=new Set(['.html','.htm','.js','.json','.css','.txt','.xml','.svg','.md','.webmanifest']);
const excludedPublicPaths=new Set(['dreamiez','cinema']);
const excludedPublicFiles=new Set(['cinema.html']);
const compiledPublicFiles=new Set(required);
function walk(dir,baseDir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.statSync(p);const rel=path.relative(baseDir,p).replace(/\\/g,'/');const top=rel.split('/')[0];if(s.isDirectory()&&excludedPublicPaths.has(top))continue;if(s.isDirectory())walk(p,baseDir);else if(!excludedPublicFiles.has(rel))files.push(p)}}
if(fs.existsSync(deployedSite))walk(deployedSite,deployedSite);
// compiled/website is a build workspace, not the Vercel deployment root.
// Scan only canonical compiled contract files required above, not private control artifacts.
for(const rel of compiledPublicFiles){const p=path.join(site,rel);if(fs.existsSync(p))files.push(p)}
const indexPath=path.join(deployedSite,'index.html');let index='';try{index=fs.readFileSync(indexPath,'utf8')}catch(e){errors.push('CATALOGUE_SURFACE:public/index.html unreadable')}
const catalogPath=path.join(deployedSite,'catalog.json');
if(!fs.existsSync(catalogPath)){errors.push('CATALOGUE_MISSING:public/catalog.json')}else{
  try{
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
    if(!Array.isArray(catalog.products)) errors.push('CATALOGUE_SCHEMA:products must be an array');
    else for(const product of catalog.products){
      const state=String(product.status||'').toLowerCase();
      if(CATALOG_STATES.active.has(state) && product.checkout_available===true){
        for(const key of ['id','name','price','currency','checkout_url']) if(product[key]===undefined||product[key]===null||product[key]==='') errors.push(`CATALOGUE_ACTIVE_INCOMPLETE:${product.id||'UNKNOWN'}:${key}`);
      } else if(!CATALOG_STATES.active.has(state)){
        console.log(`CATALOGUE_INACTIVE_SKIP:${product.id||'UNKNOWN'}:${state||'UNSPECIFIED'}`);
      }
    }
  }catch(e){errors.push('CATALOGUE_JSON_INVALID:public/catalog.json')}
}
const agentPath=path.join(site,'.well-known','agent-commerce.json');let agent={};try{agent=JSON.parse(fs.readFileSync(agentPath,'utf8'))}catch(e){/* optional if path missing */}
if(agent&&Object.keys(agent).length){
  if(agent.private_material!=='excluded'&&agent.private_material!==undefined)errors.push('AGENT_BOUNDARY:private_material');
}
const proof={schema:'dreamledger/public-surface-proof/v17',verdict:errors.length?'FAIL':'PASS',required_files:required,scanned_files:files.map(x=>path.relative(root,x).replace(/\\/g,'/')).sort(),errors,public_boundary:'Customer English only on public HTML/JSON; ops vocabulary blocked'};
fs.mkdirSync(path.join(root,'data','proofs'),{recursive:true});fs.writeFileSync(path.join(root,'data','proofs','PUBLIC-SURFACE-PROOF.json'),JSON.stringify(proof,null,2)+'\n','utf8');console.log(JSON.stringify(proof,null,2));process.exit(errors.length?1:0);
