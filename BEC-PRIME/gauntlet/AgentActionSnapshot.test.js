'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {evaluate,writeEvidenceEnvelope,sha256,RULE_IDS}=require('./AgentActionSnapshot');
const AT='2026-10-31T03:10:00Z';
function sample(){
  const approval={approved:true,ref:'synthetic'},event={ref:'fixture'};
  return {
    schema:'beck/agent-action-input/v1',scope:{tenant_id:'tenant_a'},
    action:{id:'action_a',actor_id:'agent_a',tenant_id:'tenant_a',
      target_tenant_id:'tenant_a',type:'refund_proposal',amount_minor:10000,
      currency:'nzd',created_at:'2026-10-31T03:08:00Z'},
    policy:{expected_tenant_id:'tenant_a',currency:'nzd',
      max_amount_minor:15000,allowed_actions:['refund_proposal'],
      required_evidence_types:['approval','source_event']},
    evidence:[
      {evidence_id:'approval_a',type:'approval',source:'synthetic',
        payload:approval,payload_sha256:'sha256:'+sha256(approval)},
      {evidence_id:'event_a',type:'source_event',source:'synthetic',
        payload:event,payload_sha256:'sha256:'+sha256(event)}
    ],history:{seen_action_ids:[]}
  };
}
const {evaluateAgentActionSnapshot}=require('./GauntletV6');
const run=x=>evaluateAgentActionSnapshot(x,{evaluatedAt:AT});
test('seven deterministic rules',()=>{
  const a=run(sample()),b=run(sample());
  assert.equal(a.overall,'PASS');assert.equal(a.rules.length,7);
  assert.deepEqual(a.rules.map(x=>x.rule_id),RULE_IDS);
  assert.equal(a.input_sha256,b.input_sha256);
  assert.equal(a.output_sha256,b.output_sha256);
  assert.equal(a.production_checkout_approved,false);
});
test('missing evidence quarantines',()=>{
  const x=sample();x.evidence.pop();
  assert.equal(run(x).overall,'QUARANTINE');
});
test('tampered evidence fails',()=>{
  const x=sample();x.evidence[0].payload.approved=false;
  assert.equal(run(x).rules[4].status,'FAIL');
});
test('cross tenant fails',()=>{
  const x=sample();x.action.target_tenant_id='tenant_b';
  assert.equal(run(x).rules[3].status,'FAIL');
});
test('replay fails',()=>{
  const x=sample();x.history.seen_action_ids=['action_a'];
  assert.equal(run(x).rules[5].status,'FAIL');
});
test('criteria exceedance fails',()=>{
  const x=sample();x.policy.max_amount_minor=9000;
  assert.equal(run(x).rules[6].status,'FAIL');
});
test('amount/currency corruption fails',()=>{
  const x=sample();x.action.amount_minor=1.5;x.action.currency='usd';
  assert.equal(run(x).rules[2].status,'FAIL');
});
test('append-only and hash verified, no Elohim scores',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gauntlet-'));
  try{
    const input=sample(),r=writeEvidenceEnvelope(input,run(input),dir,
      {runId:'fixture_001',ingestedAt:AT});
    const e=JSON.parse(fs.readFileSync(r.envelope_ref,'utf8'));
    assert.equal(e.metadata.financial_event,false);
    const {integrity,content_hash,...body}=e;
    assert.equal(content_hash,'sha256:'+sha256(body));
    assert.equal(integrity.content_hash,content_hash);
    assert.equal(e.payload_hash,
      'sha256:'+sha256(fs.readFileSync(r.payload_ref,'utf8').trim()));
    assert.throws(()=>writeEvidenceEnvelope(input,run(input),dir,
      {runId:'fixture_001'}),/already_exists/);
    assert.ok(!fs.readdirSync(dir).some(x=>x.includes('scorecard')));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('existing Gauntlet V6 entrypoint delegates to versioned offline adapter',()=>{
  assert.equal(typeof evaluateAgentActionSnapshot,'function');
  const a=run(sample());
  assert.equal(a.engine,'BEC-PRIME/gauntlet/AgentActionSnapshot.js');
  assert.equal(a.scorecard_authority,'ELOHIM_ONLY');
});
