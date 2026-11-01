import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,observe} from './beck-autonomy-gate.mjs';
const A='a'.repeat(40);
const B='b'.repeat(40);
const good={number:930,state:'open',head_sha:A,checks_complete:true,
  url:'https://github.com/KelpCoin/DreamLedger/pull/930',checks:[
    {name:'MTG catalogue validation',status:'completed',conclusion:'success'},
    {name:'Fulfillment Gate',status:'completed',conclusion:'success'}]};
const snapshot=pull_requests=>({checked_at:'2026-11-01T02:00:00Z',source_commit:B,pull_requests});
test('failing release checks take precedence over other commercial ideas',()=>{
 const out=evaluate(snapshot([{...good,checks:[...good.checks,{name:'Stripe Checkout Contract',
  status:'completed',conclusion:'failure'}]}]));
 assert.equal(out.next_bounded_job.operation,'REPAIR_EXISTING_RELEASE_CI');
 assert.match(out.next_bounded_job.reason,/Stripe Checkout Contract/);
 assert.equal(out.status,'NOT_ECONOMICALLY_VALIDATED');
 assert.equal(out.attributable_revenue_nzd,null);
 assert.equal(out.public_release,'OWNER_APPROVAL_REQUIRED');
});
test('even green CI does not become proof of paid delivery or economic success',()=>{
 const a=evaluate(snapshot([good]));
 assert.equal(a.next_bounded_job.operation,'VERIFY_LIVE_RUNTIME_AND_PAID_DELIVERY');
 assert.equal(a.production_verified,false);
 assert.equal(a.external_paid_and_delivered_orders_verified,null);
 assert.equal(a.contribution_profit_nzd,null);
 assert.equal(a.next_bounded_job.approval_required,true);
});
test('missing GitHub check evidence fails closed',()=>{
 const out=evaluate(snapshot([{...good,checks_complete:false,checks:[]}]));
 assert.equal(out.inspected_pull_requests[0].status,'UNVERIFIED');
 assert.equal(out.next_bounded_job.operation,'REPAIR_RELEASE_OBSERVABILITY');
});
test('no PR data cannot generate a green release',()=>{
 const out=evaluate(snapshot([]));
 assert.equal(out.next_bounded_job.operation,'REPAIR_RELEASE_OBSERVABILITY');
 assert.equal(out.status,'NOT_ECONOMICALLY_VALIDATED');
});
test('an outstanding nonrelease CI failure takes priority before provider release',()=>{
 const out=evaluate(snapshot([good,{...good,number:926,head_sha:B,checks:[
  {name:'BEC-PRIME Gates',status:'completed',conclusion:'failure'}]}]));
 assert.equal(out.next_bounded_job.operation,'REPAIR_CROSS_SILO_CI');
 assert.equal(out.next_bounded_job.scope,'GitHub PR #926');
});
test('running CI blocks promotion',()=>{
 const out=evaluate(snapshot([{...good,checks:[{name:'MTG catalogue validation',status:'in_progress',conclusion:null}]}]));
 assert.equal(out.next_bounded_job.operation,'WAIT_FOR_RELEASE_TESTS');
 assert.equal(out.inspected_pull_requests[0].status,'PENDING');
});
test('report hash of the same observation is deterministic',()=>{
 const a=evaluate(snapshot([good])),b=evaluate(snapshot([good]));
 assert.equal(a.snapshot_sha256,b.snapshot_sha256);
 assert.match(a.snapshot_sha256,/^[a-f0-9]{64}$/);
});
test('freshness and source commit are carried rather than inferred',()=>{
 const a=evaluate({checked_at:'not a date',source_commit:'fake',pull_requests:[good]});
 assert.equal(a.source_commit,null);
 assert.ok(a.warnings.includes('OBSERVATION_TIME_UNVERIFIED'));
});
test('GitHub monitor observes the correct current SHA and check results read-only',async()=>{
 const calls=[];const get=async url=>{
  calls.push(url);
  if(url.endsWith('/pulls/930'))return {ok:true,json:async()=>({
    state:'open',draft:false,head:{sha:A}})};
  if(url.includes('/commits/'+A+'/check-runs'))return {ok:true,json:async()=>({
    total_count:2,check_runs:[{name:'catalogue',status:'completed',conclusion:'success'},
      {name:'stripe',status:'completed',conclusion:'failure'}]})};
  throw Error('unexpected endpoint');
 };
 const result=await observe({token:'synthetic-not-real',prs:[930],
  commit:B,now:new Date('2026-11-01T02:00:00Z'),fetchImpl:get});
 assert.equal(calls.length,2);
 assert.equal(result.pull_requests[0].head_sha,A);
 assert.equal(result.pull_requests[0].checks_complete,true);
 assert.equal(evaluate(result).next_bounded_job.operation,'REPAIR_EXISTING_RELEASE_CI');
});
test('GitHub 403 or incomplete pages can never be promoted',async()=>{
 const err=await observe({token:'synthetic',prs:[930],fetchImpl:async()=>({ok:false,status:403})});
 assert.equal(evaluate(err).next_bounded_job.operation,'REPAIR_RELEASE_OBSERVABILITY');
 const partial=await observe({token:'synthetic',prs:[930],fetchImpl:async url=>
  url.endsWith('/pulls/930')?{ok:true,json:async()=>({state:'open',draft:false,head:{sha:A}})}
    :{ok:true,json:async()=>({total_count:101,check_runs:[{name:'one',status:'completed',conclusion:'success'}]})}});
 assert.equal(evaluate(partial).next_bounded_job.operation,'REPAIR_RELEASE_OBSERVABILITY');
});
