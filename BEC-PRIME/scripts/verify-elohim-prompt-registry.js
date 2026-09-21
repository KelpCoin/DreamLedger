'use strict';

const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'../..');
const file=path.join(root,'data','elohim_prompt_registry.json');
const r=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=[];
if(r.schema!=='dreamledger/elohim-prompt-registry/v1') errors.push('schema');
if(r.total_prompts!==150 || !Array.isArray(r.prompts) || r.prompts.length!==150) errors.push('prompt_count');
const ids=new Set();
const sections={};
for(const p of r.prompts){
  if(!p.prompt_id||ids.has(p.prompt_id)) errors.push('duplicate_or_missing_id:'+p.prompt_id);
  ids.add(p.prompt_id);
  sections[p.section]=(sections[p.section]||0)+1;
  if(p.external_action!==false) errors.push('external_action:'+p.prompt_id);
  if(!['NONE','CLASSIFICATION_ONLY','POLICY_CANDIDATE','VERIFIED_EVIDENCE'].includes(p.write_back)) errors.push('write_back:'+p.prompt_id);
  if(['A','E','F','J'].includes(p.section) && (!p.evidence_contract || p.mode!=='council' || p.models_required<3)) errors.push('council_contract:'+p.prompt_id);
  if(!['A','E','F','J'].includes(p.section) && p.mode==='council' && p.section!=='K') errors.push('unexpected_council:'+p.prompt_id);
}
for(const [s,n] of Object.entries({A:10,B:10,C:10,D:10,E:10,F:10,G:10,H:10,I:10,J:10,K:50})){
  if(sections[s]!==n) errors.push('section_count:'+s);
}
if(r.execution_contract.self_attestation_is_evidence!==false) errors.push('self_attestation');
if(r.execution_contract.council_consensus_is_business_truth!==false) errors.push('council_truth');
if(r.execution_contract.synthetic_events_are_revenue!==false) errors.push('synthetic_revenue');
if(errors.length){
  console.error(JSON.stringify({schema:'dreamledger/elohim-prompt-registry-verification/v1',status:'FAIL',errors},null,2));
  process.exit(1);
}
console.log(JSON.stringify({schema:'dreamledger/elohim-prompt-registry-verification/v1',status:'PASS',total_prompts:r.prompts.length,council_prompts:r.prompts.filter(p=>p.mode==='council').length,single_prompts:r.prompts.filter(p=>p.mode==='single').length,external_action_prompts:r.prompts.filter(p=>p.external_action).length},null,2));
