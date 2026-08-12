'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const files={
 manifest:path.join(root,'canonical','ip-manifest.json'),
 commerce:path.join(root,'canonical','commerce-loop.json'),
 assets:path.join(root,'canonical','asset-avatar-contract.json'),
 capabilities:path.join(root,'catalog','ip-capabilities.json')
};
const fail=[];
const read=k=>{if(!fs.existsSync(files[k])){fail.push(k+'_MISSING');return null;}try{return JSON.parse(fs.readFileSync(files[k],'utf8'));}catch(e){fail.push(k+'_INVALID_JSON');return null;}};
const m=read('manifest'), c=read('commerce'), a=read('assets'), p=read('capabilities');
if(m && m.rules.ip_becomes_runtime!==true) fail.push('IP_RUNTIME_DISABLED');
if(m && m.rules.public_actions_require_approval!==true) fail.push('APPROVAL_GATE_DISABLED');
if(m && m.rules.silos_are_isolated!==true) fail.push('SILO_ISOLATION_DISABLED');
if(c && c.terminal_rules.no_proven_revenue_without_verified_payment!==true) fail.push('PAYMENT_PROOF_RULE_MISSING');
if(c && !Array.isArray(c.loop)) fail.push('COMMERCE_LOOP_MISSING');
if(a && a.identity!=='canonical_sku_id') fail.push('CANONICAL_ASSET_ID_MISSING');
if(a && !a.shared_ecosystem.includes('DREAMIEZ')) fail.push('DREAMIEZ_ASSET_LINK_MISSING');
if(p && !Array.isArray(p.capabilities)) fail.push('IP_CAPABILITY_CATALOG_MISSING');
const proof={schema:'dreamledger/ip-runtime-contract/v1',verdict:fail.length?'FAIL':'PASS',files:Object.keys(files),failed:fail};
const out=path.join(root,'data','proofs','IP-RUNTIME-CONTRACT-PROOF.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
process.exit(fail.length?1:0);
