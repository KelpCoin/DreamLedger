#!/usr/bin/env node
'use strict';
// BECK: read-only, fail-closed economics-first observation. Uses existing GitHub
// mission issues and PRs. It is NOT a new dispatcher or agent, and cannot publish.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

const HASH=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const DEFAULT_PRS=[930,926,921,924];
const VALID_CONCLUSIONS=new Set(['success','failure','timed_out','cancelled','action_required','neutral','skipped','stale']);
function validSha(x){return typeof x==='string'&&/^[a-f0-9]{40}$/.test(x)}
export function evaluate(snapshot){
 const prs=Array.isArray(snapshot?.pull_requests)?snapshot.pull_requests:[];
 const checkedAt=typeof snapshot?.checked_at==='string'?snapshot.checked_at:null;
 const warnings=[];
 if(!checkedAt||!Number.isFinite(Date.parse(checkedAt)))warnings.push('OBSERVATION_TIME_UNVERIFIED');
 const observed=prs.filter(x=>x&&Number.isInteger(x.number)&&x.number>0);
 const inspected=observed.map(x=>{
  const checks=Array.isArray(x.checks)?x.checks:[];
  const failed=checks.filter(c=>c?.conclusion==='failure'||c?.conclusion==='timed_out'||c?.conclusion==='action_required').map(c=>String(c.name||'unnamed').slice(0,100));
  const incomplete=checks.some(c=>c?.status!=='completed'&&!c?.conclusion);
  const status=x.error||!validSha(x.head_sha)||!x.checks_complete?'UNVERIFIED'
    :failed.length?'RED'
    :incomplete?'PENDING'
    :checks.length?'NO_KNOWN_FAILURES':'UNVERIFIED';
  return {number:x.number,url:x.url||null,head_sha:validSha(x.head_sha)?x.head_sha:null,
   draft:x.draft===true,state:x.state||'unknown',status,failed_checks:failed.slice(0,25),
   check_count:checks.length,error:x.error?String(x.error).slice(0,120):null};
 });
 const target=inspected.find(x=>x.number===930);
 const failed=inspected.filter(x=>x.status==='RED');
 let next;
 if(!target||target.status==='UNVERIFIED'){
  next={operation:'REPAIR_RELEASE_OBSERVABILITY',scope:'GitHub PR #930',
   reason:'Release-branch checks or head SHA have not been independently observed',
   acceptance:'Re-fetch current PR head and complete GitHub check conclusions',
   approval_required:false};
 }else if(target.status==='RED'){
  next={operation:'REPAIR_EXISTING_RELEASE_CI',scope:'GitHub PR #930',
   reason:target.failed_checks.join('; ').slice(0,500),
   acceptance:'Every required release check passes on the same current PR head SHA, with logs',
   approval_required:false};
 }else if(target.status==='PENDING'){
  next={operation:'WAIT_FOR_RELEASE_TESTS',scope:'GitHub PR #930',
   reason:'Current release checks are still running',
   acceptance:'Complete existing CI and re-observe results',
   approval_required:false};
 }else if(failed.length){
  const x=failed[0];next={operation:'REPAIR_CROSS_SILO_CI',scope:'GitHub PR #'+x.number,
   reason:x.failed_checks.join('; ').slice(0,500),
   acceptance:'Failing tests pass on the exact current PR head SHA without disabling gates',
   approval_required:false};
 }else{
  next={operation:'VERIFY_LIVE_RUNTIME_AND_PAID_DELIVERY',scope:'Existing BECK cloud providers',
   reason:'CI is not provider deployment, settled payment, delivery, or buyer demand evidence',
   acceptance:'Provider-sourced deployment SHA, independent paid order, delivery receipt and contribution margin checked; explicit release approval',
   approval_required:true};
 }
 const source={checked_at:checkedAt,repository:'KelpCoin/DreamLedger',pull_requests:inspected,
  source_commit:validSha(snapshot?.source_commit)?snapshot.source_commit:null};
 const report={
  schema:'BECK/autonomy-economic-gate/v1',
  observed_at_utc:checkedAt,
  inspected_repo:source.repository,
  snapshot_sha256:HASH(source),
  source_commit:source.source_commit,
  status:'NOT_ECONOMICALLY_VALIDATED',
  production_verified:null,
  external_paid_and_delivered_orders_verified:null,
  attributable_revenue_nzd:null,
  contribution_profit_nzd:null,
  demand_repeatability:'UNVERIFIED',
  reason:'GitHub PR and CI data do not independently attest payment settlement, delivery, operating costs, or buyer demand',
  public_release:'OWNER_APPROVAL_REQUIRED',
  cloud_build_permission:'DRAFT_BRANCH_AND_TESTS_ONLY',
  forbidden_provider:'Render',
  no_new_recurring_spend:true,
  routine_operator_work_required:false,
  owner_approval_may_be_required:next.approval_required,
  queue_policy:'REUSE_EXISTING_CUBE_AND_GITHUB_ISSUES',
  inspected_pull_requests:inspected,
  next_bounded_job:next,
  warnings
 };
 return report;
}
async function getJson(url,token,fetchImpl=fetch){
 const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),8000);
 try {
  const r=await fetchImpl(url,{method:'GET',headers:{accept:'application/vnd.github+json',
   'x-github-api-version':'2022-11-28',authorization:'Bearer '+token},signal:ctl.signal});
  if(!r.ok)throw Error('github_api_http_'+r.status);
  return await r.json();
 }finally{clearTimeout(t)}
}
export async function observe({token,prs=DEFAULT_PRS,commit='',now=new Date(),fetchImpl=fetch}={}){
 if(!token||!Array.isArray(prs)||!prs.length||prs.length>8)throw Error('GITHUB_READ_TOKEN_OR_PRS_MISSING');
 const rows=[];
 for(const n of prs) {
  if(!Number.isInteger(n)||n<1||n>100000)throw Error('INVALID_PR_NUMBER');
  const base='https://api.github.com/repos/KelpCoin/DreamLedger';
  let row={number:n,url:'https://github.com/KelpCoin/DreamLedger/pull/'+n,
   state:'unknown',draft:null,head_sha:null,checks_complete:false,checks:[]};
  try{
   const p=await getJson(base+'/pulls/'+n,token,fetchImpl);
   row.state=p.state;row.draft=p.draft;row.head_sha=p.head?.sha||null;
   if(!validSha(row.head_sha))throw Error('INVALID_GITHUB_HEAD');
   const s=await getJson(base+'/commits/'+row.head_sha+'/check-runs?per_page=100',token,fetchImpl);
   const checks=Array.isArray(s.check_runs)?s.check_runs:[];
   row.checks_complete=Number.isInteger(s.total_count)&&s.total_count===checks.length&&s.total_count>0;
   row.checks=checks.slice(0,100).map(x=>({name:x.name,status:x.status,conclusion:VALID_CONCLUSIONS.has(x.conclusion)?x.conclusion:null}));
  }catch(e){row.error=String(e.message||e).slice(0,100)}
  rows.push(row);
 }
 return {checked_at:now.toISOString(),source_commit:commit,pull_requests:rows};
}
export async function run({env=process.env,argv=process.argv.slice(2),fetchImpl=fetch}={}){
 const flag=k=>{const i=argv.indexOf(k);return i<0?'':argv[i+1]||''};
 const output=flag('--output')||path.join('economic-bootstrap','autonomy','latest.json');
 const prs=flag('--prs')?flag('--prs').split(',').map(Number):DEFAULT_PRS;
 let snapshot;
 try{snapshot=await observe({token:env.GITHUB_TOKEN||env.GH_API_TOKEN,
  commit:env.GITHUB_SHA||'',prs,fetchImpl})}
 catch(e){snapshot={checked_at:new Date().toISOString(),source_commit:env.GITHUB_SHA||'',
  pull_requests:[],error:String(e.message||e)}}
 const result=evaluate(snapshot);
 if(snapshot.error)result.warnings.push(String(snapshot.error).slice(0,100));
 const out=path.resolve(output);
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',mode:0o600});
 const bytes=fs.readFileSync(out);
 const fileHash=crypto.createHash('sha256').update(bytes).digest('hex');
 const label=result.next_bounded_job.operation;
 console.log(JSON.stringify({verdict:result.status,next_job:label,proof_path:out,
   proof_sha256:fileHash,external_revenue_verified:false,release_approved:false}));
 if(env.GITHUB_STEP_SUMMARY){
  fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
   '\n### BECK economic autonomy gate\n\nVerdict: **'+result.status+
   '**. Next: **'+label+'**. Proof SHA-256: \`'+fileHash+'\`. No live revenue claimed.\n');
 }
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 run().catch(e=>{console.error('AUTONOMY_GATE_FAILED',String(e.message||e));process.exitCode=2});
}
