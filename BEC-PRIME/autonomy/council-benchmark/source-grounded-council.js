'use strict';
const crypto=require('crypto');

const AUTHORITY_FIELDS=Object.freeze(['publish','send_external_message','spend_money','stripe_mutation','truth_mutation','buyer_record_mutation','revenue_mutation','live_offer_promotion']);
const ROLES=Object.freeze({
  source_grounded_strategic_simulation:{id:'A',label:'Source-grounded strategic simulation'},
  skeptical_adversarial_operator:{id:'B',label:'Skeptical adversarial operator'},
  economic_revenue_analyst:{id:'C',label:'Economic/revenue analyst'}
});
function sha(value){return crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');}
function validateSourcePack(pack){
  if(!pack||!pack.subject||!pack.subject.name) throw new Error('SOURCE_SUBJECT_REQUIRED');
  if(pack.subject.representation!=='PUBLIC_SOURCE_ANALYTICAL_SIMULATION_ONLY') throw new Error('PERSONA_REPRESENTATION_BOUNDARY_REQUIRED');
  if(!Array.isArray(pack.sources)||pack.sources.length===0) throw new Error('SOURCE_PACK_EMPTY');
  for(const s of pack.sources){
    for(const k of ['source','title','date','url','extraction_timestamp_utc','content_sha256']) if(!s[k]) throw new Error('SOURCE_PROVENANCE_MISSING_'+k);
    if(!/^https?:\/\//.test(s.url)) throw new Error('SOURCE_URL_INVALID');
    if(!/^[a-f0-9]{64}$/.test(s.content_sha256)) throw new Error('SOURCE_HASH_INVALID');
  }
  return true;
}
function buildPersonaSpec(pack){
  validateSourcePack(pack);
  return {
    type:'PUBLIC_SOURCE_ANALYTICAL_SIMULATION',
    subject:pack.subject.name,
    not_the_person:true,
    no_private_reasoning:true,
    no_endorsement:true,
    no_authorization:true,
    source_ids:pack.sources.map(s=>s.id),
    documented_patterns:[...new Set(pack.sources.flatMap(s=>s.claims||[]))].sort(),
    spec_hash:sha({subject:pack.subject.name,sources:pack.sources.map(s=>({id:s.id,hash:s.content_sha256,claims:s.claims||[]}))})
  };
}
function buildCouncilInput(state,pack,decisionQuestion){
  validateSourcePack(pack);
  if(!state||typeof state!=='object') throw new Error('STATE_REQUIRED');
  if(!decisionQuestion) throw new Error('DECISION_QUESTION_REQUIRED');
  const base={decision_question:decisionQuestion,verified_state:JSON.parse(JSON.stringify(state)),source_pack:JSON.parse(JSON.stringify(pack)),authority:'ADVISORY_ONLY',required_fields:['recommendation','reasoning','evidence','assumptions','unknowns','falsification_condition','proposed_experiment','expected_measurable_signal','authority_required','reasons_not_to_pursue']};
  return Object.freeze(base);
}
function rolePrompt(role,input){
  if(!ROLES[role]) throw new Error('ROLE_UNKNOWN');
  return {
    role,
    role_label:ROLES[role].label,
    independence:'INDEPENDENT_ANALYSIS',
    input_hash:sha(input),
    instruction:role==='source_grounded_strategic_simulation'
      ? 'Use only documented source patterns as the simulation basis. Never claim to be the real person.'
      : role==='skeptical_adversarial_operator'
      ? 'Analyze the identical state independently. Do not inherit conclusions from other council members.'
      : 'Analyze the identical state independently for economic proximity, measurable signal and evidence requirements. Do not inherit conclusions.'
  };
}
function detectDisagreements(outputs){
  const keys=['recommendation','proposed_experiment','expected_measurable_signal'];
  const out={};
  for(const k of keys){
    const vals=outputs.map(x=>String(x[k]??'').trim()).filter(Boolean);
    out[k]={unique_count:new Set(vals).size,disagreement:new Set(vals).size>1};
  }
  return out;
}
function detectUnsupportedClaims(output,knownEvidence){
  const text=JSON.stringify(output);
  const unsupported=[];
  const claims=Array.isArray(output.evidence)?output.evidence:[];
  for(const c of claims){
    if(!c||!c.source_id||!knownEvidence.has(c.source_id)) unsupported.push(c);
  }
  if(/guaranteed|will definitely|certain revenue|he personally recommends|authorized by/i.test(text)) unsupported.push({reason:'unsupported certainty or private-authority language'});
  return unsupported;
}
function enforceAuthority(output){
  const requested=Array.isArray(output.authority_required)?output.authority_required:[];
  const forbidden=requested.filter(x=>AUTHORITY_FIELDS.includes(x));
  return {allowed:false,forbidden_authority_requests:forbidden,reason:'Council output is advisory and cannot execute consequential actions.'};
}
function synthesizeAfterIndependence(outputs){
  if(!Array.isArray(outputs)||outputs.length!==3) throw new Error('THREE_INDEPENDENT_OUTPUTS_REQUIRED');
  const hashes=outputs.map(x=>sha(x));
  return {stage:'SYNTHESIS_AFTER_INDEPENDENCE',input_hashes:hashes,disagreements:detectDisagreements(outputs),authority:'ADVISORY_ONLY',economic_truth_mutation:false,external_dispatch:false};
}
module.exports={ROLES,AUTHORITY_FIELDS,validateSourcePack,buildPersonaSpec,buildCouncilInput,rolePrompt,detectDisagreements,detectUnsupportedClaims,enforceAuthority,synthesizeAfterIndependence,sha};
