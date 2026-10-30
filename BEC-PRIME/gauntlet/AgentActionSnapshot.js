'use strict';
// Offline adapter within the existing BEC-PRIME Gauntlet tree. Never performs live commerce.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const RULEPACK_FILE = path.join(__dirname,'rulepacks','agent-action-snapshot','v1.0.0','rules.json');
const RULE_IDS = [
  'agent.schema.valid','agent.identities.unique','agent.amount_currency.consistent',
  'agent.tenant.scope','agent.evidence.integrity','agent.replay.timestamp',
  'agent.acceptance.criteria'
];
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
function sha256(value) {
  return crypto.createHash('sha256').update(typeof value==='string'?value:canonical(value),'utf8').digest('hex');
}
function plain(x) { return x!==null&&typeof x==='object'&&!Array.isArray(x); }
function nonempty(x){return typeof x==='string'&&x.trim().length>0;}
function safeId(x){return nonempty(x)&&/^[a-zA-Z0-9_-]{1,120}$/.test(x);}
function fail(code,msg){return {status:'FAIL',reason:code,message:msg};}
function unverified(code,msg){return {status:'UNVERIFIED',reason:code,message:msg};}
function pass(msg){return {status:'PASS',reason:'OK',message:msg};}
function evaluate(input,options={}) {
  const pack=JSON.parse(fs.readFileSync(RULEPACK_FILE,'utf8'));
  if(pack.rulepack_id!=='agent-action-snapshot'||pack.version!=='1.0.0'||
     canonical(pack.rules)!==canonical(RULE_IDS.map(id=>id+'@1.0.0')))throw Error('rulepack_integrity_mismatch');
  const evaluatedAt=options.evaluatedAt||new Date().toISOString();
  const clock=Date.parse(evaluatedAt);
  if(!Number.isFinite(clock))throw Error('invalid_evaluation_timestamp');
  if(!plain(input))throw Error('input_object_required');
  const a=plain(input.action)?input.action:{},p=plain(input.policy)?input.policy:{};
  const scope=plain(input.scope)?input.scope:{};
  const evidence=Array.isArray(input.evidence)?input.evidence:[];
  const history=plain(input.history)?input.history:{};
  const rules=[];
  const put=(rule,verdict)=>rules.push({rule_id:rule,rule_version:'1.0.0',...verdict});
  const schemaOk=input.schema==='beck/agent-action-input/v1'&&plain(input.action)&&
    plain(input.policy)&&plain(input.scope)&&Array.isArray(input.evidence)&&
    plain(input.history)&&nonempty(a.type)&&nonempty(p.currency)&&
    Array.isArray(p.allowed_actions)&&Array.isArray(p.required_evidence_types)&&
    Array.isArray(history.seen_action_ids);
  put(RULE_IDS[0],schemaOk?pass('Recognized offline payload structure'):
    fail('SCHEMA_INVALID','Mandatory action, scope, policy, evidence or history fields missing'));
  const ids=evidence.map(e=>e&&e.evidence_id);
  const idsOk=safeId(a.id)&&safeId(a.actor_id)&&safeId(a.tenant_id)&&
    evidence.every(e=>plain(e)&&safeId(e.evidence_id))&&new Set(ids).size===evidence.length;
  put(RULE_IDS[1],idsOk?pass('Action/actor/tenant IDs present; evidence IDs distinct'):
    fail('ID_INVALID_OR_DUPLICATE','Missing identity, malformed ID or repeated evidence ID'));
  const moneyOk=Number.isSafeInteger(a.amount_minor)&&a.amount_minor>=0&&
    /^[a-z]{3}$/.test(a.currency||'')&&a.currency===p.currency;
  put(RULE_IDS[2],moneyOk?pass('Integer minor units and policy currency agree'):
    fail('AMOUNT_CURRENCY_MISMATCH','Unsafe amount, currency or units'));
  const tenantOk=safeId(scope.tenant_id)&&scope.tenant_id===a.tenant_id&&
    scope.tenant_id===p.expected_tenant_id&&
    (a.target_tenant_id===undefined||a.target_tenant_id===scope.tenant_id);
  put(RULE_IDS[3],tenantOk?pass('Supplied tenant and scope identifiers agree'):
    fail('TENANT_SCOPE_CONTRADICTION','Action, target, scope or policy tenant mismatch'));
  const requiredTypes=Array.isArray(p.required_evidence_types)?p.required_evidence_types:[];
  let evidenceStatus='PASS', evidenceReason='OK';
  for(const type of requiredTypes){
    if(!evidence.some(e=>e&&e.type===type)){
      evidenceStatus='UNVERIFIED';evidenceReason='REQUIRED_EVIDENCE_MISSING';break;
    }
  }
  if(evidenceStatus==='PASS'){
    for(const e of evidence){
      if(!plain(e)||!nonempty(e.source)||!plain(e.payload)||
         e.payload_sha256!=='sha256:'+sha256(e.payload)){
        evidenceStatus='FAIL';evidenceReason='EVIDENCE_HASH_OR_SOURCE_INVALID';break;
      }
    }
    if(!evidence.length){evidenceStatus='UNVERIFIED';evidenceReason='NO_EVIDENCE';}
  }
  put(RULE_IDS[4],evidenceStatus==='PASS'?
    pass('Supplied bytes match hashes; external provenance not authenticated'):
    evidenceStatus==='FAIL'?
      fail(evidenceReason,'Supplied evidence hash or source invalid'):
      unverified(evidenceReason,'Evidence incomplete; cannot certify claim'));
  const t=Date.parse(a.created_at);
  const replayOk=Number.isFinite(t)&&t<=clock+300000&&t>=clock-86400000&&
    Array.isArray(history.seen_action_ids)&&!history.seen_action_ids.includes(a.id);
  put(RULE_IDS[5],replayOk?pass('Within 24h window and not in supplied replay history'):
    fail('REPLAY_OR_TIME_CONTRADICTION','Timestamp stale/future or ID repeated in supplied history'));
  const criteriaOk=Array.isArray(p.allowed_actions)&&p.allowed_actions.includes(a.type)&&
    Number.isSafeInteger(p.max_amount_minor)&&p.max_amount_minor>=0&&
    Number.isSafeInteger(a.amount_minor)&&a.amount_minor<=p.max_amount_minor;
  put(RULE_IDS[6],criteriaOk?pass('Action matches declared acceptance criteria'):
    fail('POLICY_CRITERIA_FAILED','Action type or amount outside supplied limits'));
  const overall=rules.some(x=>x.status==='FAIL')?'FAIL':
    rules.some(x=>x.status==='UNVERIFIED')?'QUARANTINE':'PASS';
  const substantive={
    schema:'beck/gauntlet-action-snapshot/v1',
    engine:'BEC-PRIME/gauntlet/AgentActionSnapshot.js',
    engine_version:'1.0.0',
    rulepack:{id:pack.rulepack_id,version:pack.version,sha256:sha256(pack)},
    scope:{tenant_id:scope.tenant_id||null,action_id:a.id||null},
    input_sha256:'sha256:'+sha256(input),overall,rules,
    limitations:[
      'Offline structural and consistency review only; not live transaction authorization',
      'Evidence was supplied by customer; no independent external provider authentication',
      'No live identity, bank, payment, credential, refund, or legal/compliance verification',
      'No guarantee of security, consent, financial accuracy, or production safety'
    ],
    external_revenue_verified_nzd:0,production_checkout_approved:false,
    scorecard_authority:'ELOHIM_ONLY',
    synthetic_or_customer_input_is_not_verified_payment:true
  };
  return {...substantive,evaluated_at:new Date(clock).toISOString(),
    output_sha256:'sha256:'+sha256(substantive)};
}
function writeEvidenceEnvelope(input,result,dir,options={}) {
  // Append-only evidence producer, NOT an Elohim scorecard writer.
  if(fs.existsSync(dir)&&!fs.statSync(dir).isDirectory())throw Error('evidence_root_must_be_directory');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const runId=String(options.runId||crypto.randomUUID());
  if(!safeId(runId))throw Error('unsafe_run_id');
  const evidenceId='ev_gauntlet_'+runId;
  const payloadRef=path.join(dir,evidenceId+'.payload.json');
  const envelopeRef=path.join(dir,evidenceId+'.envelope.json');
  if(fs.existsSync(payloadRef)||fs.existsSync(envelopeRef))throw Error('evidence_id_already_exists');
  const body=canonical({input,result});
  const payloadHash='sha256:'+sha256(body);
  fs.writeFileSync(payloadRef,body+'\n',{encoding:'utf8',mode:0o600,flag:'wx'});
  const envelope={
    schema:'evidence-envelope/v1',evidence_id:evidenceId,evidence_type:'gauntlet_run',
    scope:{type:'agent-action',id:input?.action?.id||'invalid'},
    source:{system:'gauntlet',component:'AgentActionSnapshot',version:'1.0.0'},
    produced_at:result.evaluated_at,ingested_at:options.ingestedAt||new Date().toISOString(),
    payload_hash:payloadHash,payload_ref:path.basename(payloadRef),
    metadata:{run_id:runId,rulepack_id:result.rulepack.id,
      rulepack_version:result.rulepack.version,overall:result.overall,
      financial_event:false,independent_buyer_proven:false}
  };
  // Hash definition excludes content_hash + integrity to avoid self-reference.
  const digest='sha256:'+sha256(envelope);
  envelope.content_hash=digest;
  envelope.integrity={algorithm:'sha256',content_hash:digest,signature:null};
  fs.writeFileSync(envelopeRef,JSON.stringify(envelope,null,2)+'\n',
    {encoding:'utf8',mode:0o600,flag:'wx'});
  return {evidence_id:evidenceId,payload_ref:payloadRef,envelope_ref:envelopeRef,
    payload_sha256:payloadHash,envelope_sha256:digest};
}
module.exports={evaluate,writeEvidenceEnvelope,sha256,canonical,RULE_IDS};
