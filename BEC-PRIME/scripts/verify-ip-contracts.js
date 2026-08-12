'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const files=['canonical/ip-manifest.json','canonical/commerce-loop.json','canonical/asset-avatar-contract.json','catalog/ip-capabilities.json'];
const results=[];
for(const rel of files){
 const p=path.join(root,rel);
 try{const x=JSON.parse(fs.readFileSync(p,'utf8')); results.push({file:rel,ok:true,schema:x.schema||null});}
 catch(e){results.push({file:rel,ok:false,error:e.message});}
}
const loop=JSON.parse(fs.readFileSync(path.join(root,'canonical/commerce-loop.json'),'utf8'));
const asset=JSON.parse(fs.readFileSync(path.join(root,'canonical/asset-avatar-contract.json'),'utf8'));
const rules=[
 ['LOOP_HAS_SIGNAL',Array.isArray(loop.loop)&&loop.loop.includes('SIGNAL')],
 ['LOOP_HAS_CHECKOUT',Array.isArray(loop.loop)&&loop.loop.includes('CHECKOUT')],
 ['LOOP_HAS_PROOF',Array.isArray(loop.loop)&&loop.loop.includes('PROOF')],
 ['NO_CROSS_SILO_DATA',loop.terminal_rules&&loop.terminal_rules.no_cross_silo_data===true],
 ['PAYMENT_REQUIRES_CHECKOUT',loop.terminal_rules&&loop.terminal_rules.no_payment_without_checkout===true],
 ['STABLE_ASSET_IDS',asset.identity==='canonical_sku_id'],
 ['SHARED_DREAMIEZ_KELP',Array.isArray(asset.shared_ecosystem)&&asset.shared_ecosystem.includes('DREAMIEZ')&&asset.shared_ecosystem.includes('KELP_ATLANTIS')]
];
const failed=results.filter(x=>!x.ok).map(x=>x.file).concat(rules.filter(x=>!x[1]).map(x=>x[0]));
const proof={schema:'dreamledger/ip-contract-proof/v1',verdict:failed.length?'FAIL':'PASS',files:results,rules:Object.fromEntries(rules),failed,generated_at:new Date().toISOString()};
const out=path.join(root,'data','proofs','IP-CONTRACT-PROOF.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));process.exit(failed.length?1:0);
