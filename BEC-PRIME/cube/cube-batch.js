'use strict';
// CUBE v2 batch adapter for CUBE. Delegates ALL business semantics to clone-silo.js.
// Produces private inactive candidates only. No network, credentials, checkout or publishing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {compileSilo} = require('./clone-silo');
const SCHEMA = 'CUBE/BATCH-QUEUE/v1';
const FILES = {manifest:'silo.json', catalogue:'catalogue.json',health:'health-contract.json',seedReview:'seed-review.json'};
const SECRET_KEY = /(?:^|[_-])(secret|password|passwd|token|credential|customer|buyer|payment[_-]?intent|api[_-]?key|private[_-]?key|auth[_-]?header|webhook[_-]?secret)(?:$|[_-])/i;
const SECRET_VALUE = /(?:sk_live_|sk_test_|rk_live_|rk_test_|whsec_|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9_.-]{12,})/i;
function insist(condition, reason) { if(!condition)throw Error('CUBE_BATCH_REJECTED: '+reason); }
function sha(content) {return crypto.createHash('sha256').update(content).digest('hex');}
function sanitize(value, depth=0) {
  insist(depth<=20,'object nesting exceeds limit');
  if(Array.isArray(value)){insist(value.length<=500,'array too large');for(const x of value)sanitize(x,depth+1);return;}
  if(value&&typeof value==='object'){
    insist(Object.keys(value).length<=500,'object too large');
    for(const [key,v] of Object.entries(value)){
      insist(!SECRET_KEY.test(key),'confidential input key: '+key);
      sanitize(v,depth+1);
    }
  } else if(typeof value==='string'){
    insist(value.length<=4096,'string too large');
    insist(!SECRET_VALUE.test(value),'credential-like input value');
  }
}
function compileQueue(queue, compiler=compileSilo) {
  insist(queue&&typeof queue==='object'&&!Array.isArray(queue),'queue must be an object');
  insist(Object.keys(queue).sort().join(',')==='jobs,schema','unexpected queue properties');
  insist(queue.schema===SCHEMA,'schema not recognized');
  insist(Array.isArray(queue.jobs)&&queue.jobs.length>0&&queue.jobs.length<=25,'job count must be 1..25');
  insist(JSON.stringify(queue).length<=512000,'queue too large');
  sanitize(queue);
  const ids=new Set(),slugs=new Set();
  const jobs=queue.jobs.map(job=>{
    insist(job&&typeof job==='object'&&!Array.isArray(job),'job object required');
    insist(Object.keys(job).sort().join(',')==='config,task_id','unexpected job properties');
    insist(typeof job.task_id==='string'&&/^[a-z][a-z0-9-]{2,63}$/.test(job.task_id),'task_id invalid');
    insist(!ids.has(job.task_id),'duplicate task id');ids.add(job.task_id);
    insist(job.config&&typeof job.config==='object'&&!Array.isArray(job.config),'job config invalid');
    const permitted=new Set(['slug','display_name','locale','jurisdiction','currency','inventory_mode','payment_provider','brand','domain_fields','peer_fee_basis_points','legal_pack','seed_candidates']);
    for(const key of Object.keys(job.config))insist(permitted.has(key),'unsupported config key: '+key);
    const output=compiler(job.config);
    insist(output&&output.manifest&&output.catalogue&&output.health&&output.seedReview,'compiler output incomplete');
    const slug=output.manifest.slug;
    insist(typeof slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=48,'compiled slug invalid');
    insist(!slugs.has(slug),'duplicate compiled slug');slugs.add(slug);
    insist(output.manifest.state==='draft'&&output.manifest.checkout_enabled===false&&output.manifest.public_approved===false&&output.manifest.community_enabled===false,'compiler attempted activation');
    insist(output.catalogue.checkout_enabled===false&&Array.isArray(output.catalogue.products)&&output.catalogue.products.length===0,'compiler emitted public sale stock');
    insist(output.health.status==='HOLD_NOT_READY'&&output.health.clone_is_production===false,'compiler health gate bypass');
    insist(output.seedReview.public===false,'seed review cannot be public');
    const contents={};
    for(const [key,filename] of Object.entries(FILES))contents[filename]=JSON.stringify(output[key],null,2)+'\n';
    const digest=sha(Object.keys(contents).sort().map(x=>x+'\n'+contents[x]).join(''));
    return {task_id:job.task_id,slug,digest,contents};
  });
  jobs.sort((a,b)=>a.task_id<b.task_id?-1:(a.task_id>b.task_id?1:0));
  return {schema:'CUBE/BATCH-RESULT/v1',status:'PRIVATE_DRAFT_ONLY',checkout_enabled:false,
    public_published:false,provider_mutations:0,paid_orders_verified:null,
    jobs:jobs.map(({task_id,slug,digest})=>({task_id,slug,digest,status:'DRAFT_HOLD'})),
    _private_jobs:jobs};
}
function within(parent,child){const r=path.relative(parent,child);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));}
function rejectUnsafeRoot(root){
  insist(typeof root==='string'&&root.trim().length>0,'output root required');
  const requested=path.resolve(root);
  const publicDir=path.resolve(__dirname,'..','..','public');
  const repoDir=path.resolve(__dirname,'..','..');
  const gitDir=path.join(repoDir,'.git');
  insist(!within(publicDir,requested)&&!within(gitDir,requested),'refuse public or git output');
  let probe=requested;
  while(!fs.existsSync(probe)){
    const next=path.dirname(probe);insist(next!==probe,'no existing output ancestor');probe=next;
  }
  const realAncestor=fs.realpathSync(probe);
  insist(!within(publicDir,realAncestor)&&!within(gitDir,realAncestor),'output symlink points into public or git');
  return requested;
}
function writeQueue(queue,root,compiler=compileSilo){
  const compiled=compileQueue(queue,compiler);
  const privateJobs=compiled._private_jobs;
  const output=rejectUnsafeRoot(root);
  for(const j of privateJobs){
    const dest=path.join(output,j.slug);
    if(fs.existsSync(dest)){
      insist(fs.lstatSync(dest).isDirectory()&&!fs.lstatSync(dest).isSymbolicLink(),'unsafe existing silo path');
      for(const [name,content] of Object.entries(j.contents)){
        const filename=path.join(dest,name);
        insist(fs.existsSync(filename)&&fs.lstatSync(filename).isFile()&&!fs.lstatSync(filename).isSymbolicLink(),'existing silo has missing or unsafe artifact: '+j.slug);
        insist(fs.readFileSync(filename,'utf8')===content,'existing silo differs: '+j.slug);
      }
    }
  }
  const report={...compiled};delete report._private_jobs;
  const reportText=JSON.stringify(report,null,2)+'\n';
  const reportFile=path.join(output,'cube-proof.json');
  if(fs.existsSync(reportFile))insist(fs.lstatSync(reportFile).isFile()&&fs.readFileSync(reportFile,'utf8')===reportText,'queue proof collision: use a new private batch directory');
  fs.mkdirSync(output,{recursive:true,mode:0o700});
  insist(!within(path.resolve(__dirname,'..','..','public'),fs.realpathSync(output)),'output resolves into public directory');
  for(const j of privateJobs){
    const dest=path.join(output,j.slug);
    if(fs.existsSync(dest))continue;
    const temp=fs.mkdtempSync(path.join(output,'.private-'+j.slug+'-'));
    try{
      for(const [name,content] of Object.entries(j.contents))fs.writeFileSync(path.join(temp,name),content,{flag:'wx',mode:0o600});
      fs.renameSync(temp,dest);
    }finally{if(fs.existsSync(temp))fs.rmSync(temp,{recursive:true,force:true});}
  }
  if(!fs.existsSync(reportFile))fs.writeFileSync(reportFile,reportText,{flag:'wx',mode:0o600});
  return {output,proof_sha256:sha(reportText),...report};
}
function main(args){
  insist(args.length===2,'usage: node BEC-PRIME/cube/cube-batch.js queue.json private_output_dir');
  const stat=fs.statSync(args[0]);insist(stat.isFile()&&stat.size<=512000,'queue file invalid or too large');
  const result=writeQueue(JSON.parse(fs.readFileSync(args[0],'utf8')),args[1]);
  process.stdout.write(JSON.stringify({status:result.status,output:result.output,proof_sha256:result.proof_sha256,compiled:result.jobs.length,checkout_enabled:false})+'\n');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={compileQueue,writeQueue,rejectUnsafeRoot,SCHEMA};
