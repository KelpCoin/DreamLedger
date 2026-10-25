'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { snapshot,renderStencil }=require('./CreatorCommerceFactory');
const expected=new Set(['agent_bridge','app_factory','automation','commerce','community','creator','data_refinery','digital_products','dooh','dreammeez','education','evidence','fightedge','licensing','marketplace','procurement']);
const S=()=>snapshot();

test('original assets preserved, 16 independent commercial vessels seeded',()=>{
  const {word_bank,stencils,generation_recipes}=S();
  assert.equal(Object.keys(word_bank.words).length,325);
  assert.equal(stencils.stencils.length,97);
  assert.equal(generation_recipes.recipes.length,18);
  assert.equal(word_bank.words.cinematic.bank,'styles');
  assert.ok(stencils.stencils.some(x=>x.id==='mtg-deck-hero-v1'));
  assert.ok(generation_recipes.recipes.some(x=>x.id==='mtg-hero-comfyui-v1'));
  assert.deepEqual(new Set(stencils.stencils.map(x=>x.policy?.silo).filter(Boolean)),expected);
});

test('all stencil slots are populated only from their own permitted silo',()=>{
  const {word_bank,stencils}=S();
  const groups=new Map();
  for(const [word,v] of Object.entries(word_bank.words)){
    assert.ok(v.bank && Number.isFinite(v.base_weight) && v.base_weight>0);
    if(v.silo){
      assert.ok(expected.has(v.silo));
      assert.equal(v.evidence_class,'HYPOTHESIS_WORDING_NOT_BUYER_DEMAND');
      assert.ok(v.bank.startsWith(v.silo+'__'));
    }
    if(!groups.has(v.bank))groups.set(v.bank,[]);
    groups.get(v.bank).push(word);
  }
  const ids=new Set();
  for(const t of stencils.stencils){
    assert.ok(!ids.has(t.id),'duplicate '+t.id);ids.add(t.id);
    assert.equal(t.status,'active');
    for(const [slot,spec] of Object.entries(t.slots||{})){
      assert.ok(t.template.includes('{'+slot+'}'),'unresolved slot in '+t.id);
      assert.ok(groups.has(spec.word_bank),'missing bank '+spec.word_bank);
      if(t.policy?.silo) assert.ok(spec.word_bank.startsWith(t.policy.silo+'__'),'cross-silo bank in '+t.id);
    }
    if(t.policy?.silo){
      assert.equal(t.policy.private_draft_only,true);
      assert.equal(t.policy.owner_approval_required_for_external_action,true);
      assert.equal(t.policy.cross_silo_customer_data,false);
      assert.equal(t.policy.fabricate_buyer_or_revenue,false);
    }
  }
});

test('actual existing renderer produces a draft for every vessel',()=>{
  for(const silo of expected){
    const item=renderStencil(silo+'-model-prompt-v1');
    assert.equal(item.stencil_id,silo+'-model-prompt-v1');
    assert.ok(item.rendered_prompt.length>60);
    assert.doesNotMatch(item.rendered_prompt,/{[a-z_]+}/);
    assert.match(item.provenance_sha256,/^[a-f0-9]{64}$/);
  }
});

test('local-neural recipes cannot claim autonomous production readiness',()=>{
  const {generation_recipes}=S();
  for(const silo of expected){
    const x=generation_recipes.recipes.find(r=>r.id===silo+'-model-draft-v1');
    assert.ok(x,'missing recipe for '+silo);
    assert.equal(x.engine,'lm_studio_local');
    assert.equal(x.status,'requires_local_model_adapter');
    assert.equal(x.approval_required,true);
    assert.equal(x.endpoint_env,'LM_STUDIO_BASE_URL');
    assert.equal(x.model_env,'LM_STUDIO_MODEL');
  }
});
