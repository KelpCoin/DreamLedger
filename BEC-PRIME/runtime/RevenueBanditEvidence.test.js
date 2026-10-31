'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {analyzeArm,assessPortfolio}=require('./RevenueBanditEvidence');

const exposure=(s,i)=>({type:'exposure',event_id:'view'+i,visit_id:'v'+i,silo:s,observed:true,source_ref:'consented-analytics'});
const sale=(s,i)=>({type:'sale',event_id:'paid'+i,silo:s,visit_id:'v'+i,payment_id:'pi_real'+i,currency:'nzd',paid_minor:4900,direct_cost_minor:300,
  external_buyer_verified:true,provider_settlement_reconciled:true,attribution_reconciled:true,
  delivery_verified:true,independent_proof_verified:true,rights_verified:true,delivery_sha256:'a'.repeat(64)});
test('all new lanes withheld from live traffic or cloning',()=>{
  const portfolio=assessPortfolio([{id:'avatar-a',silo:'avatar',events:[]},{id:'mtg-a',silo:'mtg',events:[]}]);
  assert.equal(portfolio.outcome,'NO_SUPPORTED_REWARD_TO_OPTIMIZE');
  assert.equal(portfolio.traffic_mutation_permission,undefined);
  assert.equal(portfolio.auto_tenant_spawning,false);
  assert.equal(portfolio.live_price_changes,false);
  assert(portfolio.arms.every(x=>!x.winner&&!x.clone_permission));
});
test('cross-silo sale never boosts MTG results',()=>{
  const p=analyzeArm({id:'mtg',silo:'mtg',events:[exposure('mtg',1),sale('avatar',1)]});
  assert.equal(p.provider_reconciled_sales_reported,0);
  assert(p.issue_codes.includes('CROSS_SILO_EVENT_REJECTED'));
});
test('no payment counts without provider settlement and independent proof',()=>{
  const s=sale('b2b',1);s.provider_settlement_reconciled=false;s.independent_proof_verified=false;
  const p=analyzeArm({id:'b2b',silo:'b2b',events:[exposure('b2b',1),s]});
  assert.equal(p.reported_contribution_minor,0);
  assert(p.issue_codes.includes('UNVERIFIED_ECONOMIC_EVENT'));
});
test('deduplicates identical payment and visit identifiers',()=>{
  const p=analyzeArm({id:'a',silo:'mtg',events:[exposure('mtg',1),exposure('mtg',2),sale('mtg',1),
    {...sale('mtg',2),payment_id:'pi_real1'}]});
  assert.equal(p.provider_reconciled_sales_reported,1);
  assert.equal(p.exposures,2);
});
test('cannot prune after arbitrary 25-dollar threshold or clone after 120',()=>{
  const events=[...Array.from({length:30},(_,i)=>exposure('truth_oracle',i))];
  events.push(sale('truth_oracle',0));
  const p=assessPortfolio([{id:'verified-assertions',silo:'truth_oracle',events}]);
  assert.equal(p.arms[0].reported_contribution_minor,4600);
  assert.equal(p.arms[0].readiness,'REQUIRES_INDEPENDENT_AUDIT_AND_HUMAN_APPROVAL');
  assert.equal(p.arms[0].clone_permission,false);
  assert.equal(p.arms[0].prune_permission,false);
  assert.equal(p.shadow_priority.length,1);
});
test('negative contribution does not get positive normalized reward',()=>{
  const p=analyzeArm({id:'loss',silo:'b2b',events:[exposure('b2b',0),{
    ...sale('b2b',0),direct_cost_minor:10000}]});
  assert.equal(p.reported_epv_minor,-5100);
  assert.equal(p.candidate_bandit_arm.reward,0);
  assert.equal(p.clone_permission,false);
});
test('never rank only clicks or generated hypotheses as money',()=>{
  const p=assessPortfolio([{id:'x',silo:'billboard',events:
    Array.from({length:50},(_,i)=>exposure('billboard',i))}]);
  assert.equal(p.shadow_priority.length,0);
  assert.equal(p.arms[0].readiness,'NO_ATTRIBUTABLE_ECONOMIC_OUTCOME');
});
test('rejects unsupported silo and malformed inputs',()=>{
  assert.throws(()=>analyzeArm({id:'x',silo:'adult',events:[]}),/INVALID_SILO/);
  assert.throws(()=>assessPortfolio([]),/ARMS_INVALID/);
  assert.throws(()=>assessPortfolio([{id:'same',silo:'mtg',events:[]},{id:'same',silo:'avatar',events:[]}]),/DUPLICATE_ARM/);
});
