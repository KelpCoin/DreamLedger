'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const registry=json('runtime/cube/capability-registry.json');
const manifests=['silos/mtg/silo.json','silos/music-media/silo.json'].map(p=>({path:p,value:json(p)}));
const checks=[],holds=[];const check=(name,ok)=>checks.push({name,ok:!!ok});
for(const m of manifests){const refs=m.value.capabilities||{};for(const [cap,ref] of Object.entries(refs)){const id=String(ref).replace(/^ref:/,'');const item=registry.capabilities[id];check(m.path+' resolves '+cap,!!item);if(item&&item.status!=='VERIFIED')holds.push({manifest:m.path,capability:id,status:item.status,activation_ready:false,required_evidence:item.required_evidence||[]});}}
const failed=checks.filter(x=>!x.ok),activationReady=failed.length===0&&holds.length===0;
const proof={schema:'DREAMLEDGER/CUBE-CAPABILITY-GAUNTLET/v1',verdict:failed.length?'FAIL':holds.length?'PASS_WITH_HOLDS':'PASS',activation_ready:activationReady,checks,holds,failed_checks:failed.length};
console.log(JSON.stringify(proof,null,2));if(failed.length)process.exit(1);
