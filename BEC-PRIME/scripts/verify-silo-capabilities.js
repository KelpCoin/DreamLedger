'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const registry=json('runtime/cube/capability-registry.json'),dirs=fs.readdirSync(path.join(root,'silos'),{withFileTypes:true}).filter(d=>d.isDirectory()&&fs.existsSync(path.join(root,'silos',d.name,'silo.json'))).map(d=>'silos/'+d.name+'/silo.json').sort();
const checks=[],holds=[];const check=(name,ok)=>checks.push({name,ok:!!ok});
function exists(p){return fs.existsSync(path.join(root,p));}
for(const file of dirs){const m=json(file);for(const [name,ref] of Object.entries(m.capabilities||{})){const id=String(ref).replace(/^ref:/,''),item=registry.capabilities[id];check(file+' resolves '+name,!!item);if(item&&Array.isArray(item.implementation_paths))for(const p of item.implementation_paths)check('capability file exists: '+p,exists(p));if(item&&item.status!=='VERIFIED')holds.push({manifest:file,capability:id,status:item.status,activation_ready:false,required_evidence:item.required_evidence||[]});}}
const failed=checks.filter(x=>!x.ok),ready=failed.length===0&&holds.length===0,proof={schema:'DREAMLEDGER/CUBE-CAPABILITY-GAUNTLET/v1',verdict:failed.length?'FAIL':holds.length?'PASS_WITH_HOLDS':'PASS',activation_ready:ready,manifest_count:dirs.length,checks,holds,failed_checks:failed.length};
console.log(JSON.stringify(proof,null,2));if(failed.length)process.exit(1);
