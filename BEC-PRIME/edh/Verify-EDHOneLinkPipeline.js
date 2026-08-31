'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),JOBS=path.join(ROOT,'data','mtg','edh-jobs');
function fail(m){throw Error(m)}
function main(){const jobs=fs.existsSync(JOBS)?fs.readdirSync(JOBS).filter(x=>fs.existsSync(path.join(JOBS,x,'PROOF.json'))):[];if(!jobs.length)fail('NO_EDH_PROOF_FOUND');const latest=jobs.sort().pop();const dir=path.join(JOBS,latest);const proof=JSON.parse(fs.readFileSync(path.join(dir,'PROOF.json'),'utf8'));for(const f of ['deck.json','benchmark.json','primer.md','hero-prompt.txt'])if(!fs.existsSync(path.join(dir,f)))fail('MISSING_'+f);if(proof.schema_version!=='edh-one-link-proof-v1')fail('SCHEMA_MISMATCH');if(proof.approval_required!==true)fail('APPROVAL_BOUNDARY_MISSING');console.log(JSON.stringify({status:'PASS',job_id:proof.job_id,product_id:proof.product_id,state:proof.state,comparison_count:proof.comparison_ids.length,benchmark_type:proof.benchmark_type,media_status:proof.media_status},null,2));}
main();
