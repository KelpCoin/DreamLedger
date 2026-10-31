import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueAuctionAllocation,verifyAuctionAllocation} from '../BEC-PRIME/capabilities/auction/authorization.mjs';

const key='LOCAL-TEST-NOT-PRODUCTION-'.repeat(3);
const sha='a'.repeat(40);
const scorecard={schema:'gauntlet-scorecard/v1',overall:'PASS',
 scope:{type:'silo',id:'mtg-master'},scorecard_id:'sc_mtga_20261101_valid001'};
const approval={explicit:true,reference:'owner-approval-20261101-test-01',
 economic_basis:'EXPERIMENT_APPROVED',capability:'kingdom.auction.v1',silo_id:'mtg-master'};
const resource={capability_id:'kingdom.auction.v1',silo_id:'mtg-master',
 actions:['bid','inventory','register','auction_submit','ship','deliver','checkout','dispute'],
 deployment_sha:sha,duration_seconds:900};
const stamp=1793510000000;
function issue(opts={}){const s=opts.scorecard||scorecard;
 return issueAuctionAllocation({scorecard:s,scorecardBytes:JSON.stringify(s),
  approval:opts.approval||approval,resource:opts.resource||resource,secret:key,now:stamp})}
function verify(envelope,opts={}){return verifyAuctionAllocation({envelope,secret:key,
 siloId:'mtg-master',action:'bid',deploymentSha:sha,now:stamp+1000,...opts})}

test('silo-scoped signed grant authorizes exact deployment and operation',()=>{
 const e=issue();assert.equal(verify(e).ok,true);assert.equal(verify(e).economic_basis,'EXPERIMENT_APPROVED');
});
test('Gauntlet FAIL does not mint an authorization',()=>{
 assert.throws(()=>issue({scorecard:{...scorecard,overall:'FAIL'}}),/GAUNTLET_PASS_REQUIRED/);
});
test('Explicit owner approval and commercial basis are mandatory',()=>{
 assert.throws(()=>issue({approval:{...approval,explicit:false}}),/EXPLICIT_OWNER_APPROVAL_REQUIRED/);
 assert.throws(()=>issue({approval:{...approval,economic_basis:'UNKNOWN'}}),/EXPLICIT_OWNER_APPROVAL_REQUIRED/);
});
test('Other silo cannot reuse signed grant',()=>assert.equal(verify(issue(),{siloId:'adult-silo'}).code,'WRONG_SILO'));
test('Deployment change revokes old allocation',()=>assert.equal(verify(issue(),{deploymentSha:'b'.repeat(40)}).code,'WRONG_DEPLOYMENT'));
test('Expiry and not-before enforced',()=>{
 const e=issue();
 assert.equal(verify(e,{now:stamp-1}).code,'NOT_YET_ACTIVE');
 assert.equal(verify(e,{now:stamp+900000}).code,'EXPIRED');
});
test('No allowed action outside explicit allocated scope',()=>{
 const e=issue({resource:{...resource,actions:['bid']}});
 assert.equal(verify(e,{action:'checkout'}).code,'SCOPE_DENIED');
});
test('Tampering with scorecard hash, scope or approval fails signature',()=>{
 const e=issue();
 for(const update of [
  {scorecard_sha256:'f'.repeat(64)},
  {economic_basis:'REPEATABLE_MARGIN_VERIFIED'},
  {approval_reference:'forged-ref-00000001'},
  {silo_id:'adult-silo'},
  {actions:['bid','checkout','register']}
 ]){
  const forged={payload:{...e.payload,...update},signature:e.signature};
  assert.equal(verify(forged).code,'BAD_SIGNATURE');
 }
});
test('Unsigned and missing environment fail closed',()=>{
 assert.equal(verify(null).ok,false);
 assert.equal(verify(issue(),{secret:''}).code,'UNCONFIGURED');
});
test('Reject excessive duration and unknown operations',()=>{
 assert.throws(()=>issue({resource:{...resource,duration_seconds:86401}}),/GRANT_DURATION_INVALID/);
 assert.throws(()=>issue({resource:{...resource,actions:['auction_propose','publish_unapproved']}}),/INVALID_RESOURCE_ALLOCATION/);
});
