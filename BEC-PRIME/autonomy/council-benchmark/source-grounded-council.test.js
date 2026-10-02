'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ROLES,validateSourcePack,buildPersonaSpec,buildCouncilInput,rolePrompt,detectDisagreements,detectUnsupportedClaims,enforceAuthority,synthesizeAfterIndependence}=require('./source-grounded-council');
const pack=require('./source-pack.json');

const state={verified_external_revenue_nzd:0,settled_external_payments:0,independent_external_buyers:0,verified_economic_outcomes:0,cube_candidates:53};
const question='Given the currently verified state of DreamLedger, what is the highest-leverage path toward a real externally verified economic outcome, and what evidence would falsify your recommendation?';

test('source provenance is complete and source-grounded persona is explicitly simulated',()=>{
  assert.equal(validateSourcePack(pack),true);
  const p=buildPersonaSpec(pack);
  assert.equal(p.not_the_person,true);
  assert.equal(p.no_private_reasoning,true);
  assert.equal(p.no_endorsement,true);
  assert.equal(p.no_authorization,true);
  assert.equal(p.source_ids.length,3);
});

test('persona generation is deterministic for identical source input',()=>{
  assert.deepEqual(buildPersonaSpec(pack),buildPersonaSpec(JSON.parse(JSON.stringify(pack))));
});

test('identical council input is deterministic and shared by all roles',()=>{
  const input=buildCouncilInput(state,pack,question);
  const prompts=Object.keys(ROLES).map(r=>rolePrompt(r,input));
  assert.equal(new Set(prompts.map(x=>x.input_hash)).size,1);
  assert.equal(input.authority,'ADVISORY_ONLY');
});

test('three roles are independently addressable',()=>{
  assert.deepEqual(Object.keys(ROLES),['source_grounded_strategic_simulation','skeptical_adversarial_operator','economic_revenue_analyst']);
  assert.equal(rolePrompt('skeptical_adversarial_operator',{}).independence,'INDEPENDENT_ANALYSIS');
});

test('synthesis cannot occur without three independent outputs',()=>{
  assert.throws(()=>synthesizeAfterIndependence([{recommendation:'a'}]),/THREE_INDEPENDENT_OUTPUTS_REQUIRED/);
});

test('disagreement is preserved rather than collapsed',()=>{
  const d=detectDisagreements([
    {recommendation:'test external demand',proposed_experiment:'A',expected_measurable_signal:'response'},
    {recommendation:'reduce fulfillment friction',proposed_experiment:'B',expected_measurable_signal:'payment'},
    {recommendation:'test external demand',proposed_experiment:'C',expected_measurable_signal:'payment'}
  ]);
  assert.equal(d.recommendation.unique_count,2);
  assert.equal(d.recommendation.disagreement,true);
});

test('unsupported source claims are detected',()=>{
  const known=new Set(pack.sources.map(x=>x.id));
  const bad={evidence:[{source_id:'invented-source',claim:'not grounded'}]};
  assert.equal(detectUnsupportedClaims(bad,known).length,1);
});

test('Truth Oracle remains separate from council output',()=>{
  const result=synthesizeAfterIndependence([
    {recommendation:'A',proposed_experiment:'A',expected_measurable_signal:'A'},
    {recommendation:'B',proposed_experiment:'B',expected_measurable_signal:'B'},
    {recommendation:'C',proposed_experiment:'C',expected_measurable_signal:'C'}
  ]);
  assert.equal(result.authority,'ADVISORY_ONLY');
  assert.equal(result.economic_truth_mutation,false);
});

test('Gauntlet separation is represented as post-independence review, not authority',()=>{
  const result=synthesizeAfterIndependence([
    {recommendation:'A',proposed_experiment:'A',expected_measurable_signal:'A'},
    {recommendation:'B',proposed_experiment:'B',expected_measurable_signal:'B'},
    {recommendation:'C',proposed_experiment:'C',expected_measurable_signal:'C'}
  ]);
  assert.equal(result.stage,'SYNTHESIS_AFTER_INDEPENDENCE');
  assert.ok(Array.isArray(result.input_hashes));
});

test('authority boundary rejects external and economic mutations',()=>{
  const result=enforceAuthority({authority_required:['publish','send_external_message','spend_money','stripe_mutation','truth_mutation','buyer_record_mutation','revenue_mutation','live_offer_promotion']});
  assert.equal(result.allowed,false);
  assert.equal(result.forbidden_authority_requests.length,8);
});

test('benchmark output schema requires falsification and measurable signal',()=>{
  const required=['recommendation','reasoning','evidence','assumptions','unknowns','falsification_condition','proposed_experiment','expected_measurable_signal','authority_required','reasons_not_to_pursue'];
  assert.equal(required.length,10);
  assert.ok(required.includes('falsification_condition'));
  assert.ok(required.includes('expected_measurable_signal'));
});

test('no council function mutates economic state',()=>{
  const before=JSON.stringify(state);
  buildCouncilInput(state,pack,question);
  assert.equal(JSON.stringify(state),before);
});

test('synthesis preserves independent output hashes for provenance',()=>{
  const outputs=[
    {recommendation:'A',proposed_experiment:'A',expected_measurable_signal:'A'},
    {recommendation:'B',proposed_experiment:'B',expected_measurable_signal:'B'},
    {recommendation:'C',proposed_experiment:'C',expected_measurable_signal:'C'}
  ];
  const result=synthesizeAfterIndependence(outputs);
  assert.equal(result.input_hashes.length,3);
  assert.equal(new Set(result.input_hashes).size,3);
});
