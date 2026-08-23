'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const INDEX=path.join(ROOT,'compiled','website','index.html');
if(!fs.existsSync(INDEX))throw new Error('E1 compiled public index is missing: '+INDEX);
const html=fs.readFileSync(INDEX,'utf8');
const required=['DREAMLEDGER / CATALOG','Swipe the catalog.','Digital goods','Magic: The Gathering','DreamMeez identity','Deterministic Cinema','marketplace-live.js'];
const missing=required.filter(x=>!html.toLowerCase().includes(x.toLowerCase()));if(missing.length)throw new Error('E1 CATALOG SURFACE FAILED: '+missing.join(', '));
const forbidden=['Amplissa','HappyHomarid','CollectorsCoast','adult-only','adult only','stripe_secret_key','stripe_webhook_secret'];const leaked=forbidden.filter(x=>html.toLowerCase().includes(x.toLowerCase()));if(leaked.length)throw new Error('E1 CATALOG SURFACE FAILED: '+leaked.join(', '));
const proof={status:'PASS',file:INDEX,surface:'catalog-front-door',required_present:required,forbidden_absent:forbidden,generated_at:new Date().toISOString()};fs.mkdirSync(path.join(ROOT,'RUN-PROOFS'),{recursive:true});fs.writeFileSync(path.join(ROOT,'RUN-PROOFS','E1-CATALOG-POLISH-PROOF.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
