'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const Q=path.join(ROOT,'data','factory-factory','FACTORY-FACTORY-QUEUE.json');
const P=path.join(ROOT,'data','factory-factory','approval-packets','latest.json');
const O=path.join(ROOT,'data','factory-factory','FACTORY-RUN.json');
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
function run(){
 if(!fs.existsSync(Q)) throw new Error('Run npm run compile:factory-factory first');
 const q=JSON.parse(fs.readFileSync(Q,'utf8'));
 const p=fs.existsSync(P)?JSON.parse(fs.readFileSync(P,'utf8')):null;
 const items=Array.isArray(q.queue)?q.queue:[];
 const cells=items.map(x=>({cell_id:'CELL-'+hash(x.experiment_id).slice(0,16).toUpperCase(),experiment_id:x.experiment_id,opportunity_id:x.opportunity_id,title:x.title,buyer:x.demand?.buyer||null,offer:x.proposition?.offer||null,price_nzd:Number(x.proposition?.price_nzd||0),acquisition_surfaces:x.execution?.acquisition_surface||[],fulfillment:x.execution?.fulfillment||null,state:'READY_FOR_AUTHORIZED_EXPERIMENT',authority:{publication:'APPROVAL_REQUIRED',spend:'APPROVAL_REQUIRED',charging:'APPROVAL_REQUIRED',revenue_claim:'TRUTH_ORACLE_ONLY'},success_condition:['external buyer','settled payment','correct attribution','fulfillment','independent proof'],kill_conditions:x.kill_conditions||[]}));
 const out={schema_version:'DREAMLEDGER/FACTORY-RUN/v1',generated_at_utc:new Date().toISOString(),objective:'Compile evidence-backed opportunities into bounded monetization cells.',approval_packet_count:p?.packet_count||0,cell_count:cells.length,cells,autonomy:{allowed:['scan','compile','validate','rank','prepare','reconcile','verify','quarantine'],blocked:['publish','outreach','spend','charge','production_commerce_change']},truth:'Internal computation never counts as economic proof'};
 out.integrity_sha256=hash(JSON.stringify(out));
 fs.mkdirSync(path.dirname(O),{recursive:true});fs.writeFileSync(O,JSON.stringify(out,null,2)+'\n');
 return out;
}
if(require.main===module){const r=run();console.log(JSON.stringify({status:'PASS',cell_count:r.cell_count,ready:r.cells.length},null,2));}
module.exports={run};