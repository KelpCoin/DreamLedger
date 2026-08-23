const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.join(__dirname,'..','..');
const runId=process.env.RUN_ID||`gauntlet-${Date.now()}`;
const eventType=process.env.ECONOMIC_EVENT_TYPE||'NONE';
const silo=process.env.SILO||'UNKNOWN';
const checks=[
 ['external_customer_rule',eventType==='EXTERNAL_CUSTOMER'],
 ['no_cross_silo',!['MTG','HAPPYHOMARID','COLLECTORSCOAST'].includes(silo)||silo==='MTG'],
 ['fossil_boundary',fs.existsSync(path.join(root,'Proof','Fossils'))],
 ['truth_oracle_boundary',fs.existsSync(path.join(root,'Proof','TruthOracle'))],
 ['elohim_boundary',fs.existsSync(path.join(root,'Proof','Elohim'))]
];
const result={schema_version:'GAUNTLET-1.0',run_id:runId,economic_event_type:eventType,checks:Object.fromEntries(checks.map(([n,ok])=>[n,ok?'PASS':'FAIL'])),status:checks.every(([,ok])=>ok)?'PASS':'QUARANTINE',generated_at:new Date().toISOString()};
result.sha256=crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
const out=path.join(root,'Proof','Gauntlet',`${runId}.json`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
