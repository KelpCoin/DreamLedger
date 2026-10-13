'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const json=p=>JSON.parse(read(p));
const registry=json('runtime/cube/capability-registry.json');
const manifests=fs.readdirSync(path.join(ROOT,'silos'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>'silos/'+d.name+'/silo.json').filter(p=>fs.existsSync(path.join(ROOT,p))).map(json);
const checks=[],holds=[];
const check=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
for(const m of manifests){
 const caps=m.capabilities||{};
 for(const [role,value] of Object.entries(caps)){
  const id=String(value||'').replace(/^ref:/,'');
  const cap=registry.capabilities[id];
  check(m.identity.slug+' capability '+role+' resolves',!!cap,id);
  if(cap&&cap.status!=='VERIFIED'){holds.push({code:'CAPABILITY_NOT_VERIFIED',silo:m.identity.slug,capability:id,status:cap.status});if(m.status==='active')check(m.identity.slug+' active capability '+role+' is verified',false,'status='+cap.status);}
 }
 check(m.identity.slug+' has a recognized release state',['build','active','development'].includes(m.status||'active'));
}
const failures=checks.filter(c=>!c.ok);
const proof={schema:'DREAMLEDGER/SILO-CAPABILITY-GAUNTLET/v1',status:failures.length?'FAIL':holds.length?'PASS_WITH_HOLDS':'PASS',launch_ready:failures.length===0&&holds.length===0,manifests:manifests.map(m=>m.identity.slug),checks,holds,failed_checks:failures.length,truth:{verified_external_revenue_nzd:0,settled_external_payments:0,independent_external_buyers:0,paid_fulfilled_orders:0,verified_outcomes:0}};
console.log(JSON.stringify(proof,null,2));
if(failures.length)process.exitCode=1;
