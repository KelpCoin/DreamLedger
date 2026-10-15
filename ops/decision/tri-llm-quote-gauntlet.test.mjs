import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, sha256, validateLoopbackEndpoint, validateStageOutput,
  deterministicQuoteChecks, runQuoteGauntlet, ROLE_CONFIG
} from './tri-llm-quote-gauntlet.mjs';

const testNow = '2026-10-15T08:00:00.000Z';
const contextManifest = () => {
  const body = {
    schema: 'dreamledger/context-manifest/v1',
    status: 'APPROVED',
    context_version: 'quote-context.test.v1',
    policy_version: 'quote-policy.test.v1',
    reviewed_at: '2026-10-15T07:00:00.000Z',
    expires_at: '2026-10-16T07:00:00.000Z',
    prompt_versions: Object.fromEntries(ROLE_CONFIG.map(x => [x.role,x.promptVersion])),
    model_ids: Object.fromEntries(ROLE_CONFIG.map(x => [x.role,x.model])),
    sources: [{id:'fixture-quote-policy',sha256:'a'.repeat(64),authority:'TEST_FIXTURE',captured_at:'2026-10-15T06:00:00.000Z'}]
  };
  return { ...body, manifest_sha256: sha256(canonicalJson(body)) };
};
const extraction = (gross=115) => ({
  schema_version:'dreamledger/tri-llm-extraction/v1',
  supplier:'Apex Cloud NZ',
  currency:'NZD',
  line_items:[{description:'CUBE micro diagnostic',quantity:1,unit_price:100,line_total:100,evidence_ref:'quote:line-1'}],
  taxes:{gst_rate:15,gst_amount:15,included:false},
  totals:{net_total:100,gst_total:15,gross_total:gross},
  exclusions:['On-site visits'],
  assumptions:[],
  evidence_refs:['quote:line-1'],
  limitations:['Extracted by test fixture only']
});
const audit = () => ({
  schema_version:'dreamledger/tri-llm-audit/v1',
  risk_level:'MEDIUM',
  math_findings:[],
  hidden_costs:[],
  scope_ambiguities:['On-site visits excluded'],
  injection_risks:[],
  findings:['Scope exclusion preserved'],
  evidence_refs:['quote:line-1'],
  limitations:['Test fixture is not a live quote audit']
});
const judge = verdict => ({
  schema_version:'dreamledger/tri-llm-verdict/v1',
  verdict,
  rationale:'Test fixture assessment only.',
  evidence_refs:['quote:line-1'],
  unresolved_risks:[],
  limitations:['Not a real-world proof']
});
const makeFetch = ({judgeVerdict='MATCH',gross=115,failRole=null}={}) => {
  let i=0;
  return async (url,init) => {
    const cfg=ROLE_CONFIG[i++];
    assert.equal(url,cfg.endpoint);
    assert.equal(init.headers.authorization,'Bearer test-token');
    assert.equal(init.method,'POST');
    const sent=JSON.parse(init.body);
    assert.equal(sent.model,cfg.model);
    assert.equal(sent.temperature,cfg.temperature);
    if (failRole===cfg.role) return {ok:false,status:503,text:async()=>''};
    const out=cfg.role==='EXTRACTOR'?extraction(gross):cfg.role==='GAUNTLET'?audit():judge(judgeVerdict);
    return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify(out)}}]})};
  };
};

test('canonical JSON is stable across object insertion order',()=>{
  assert.equal(canonicalJson({z:1,a:2}),'{"a":2,"z":1}');
  assert.equal(sha256(canonicalJson({a:2,z:1})),sha256(canonicalJson({z:1,a:2})));
});
test('only loopback model endpoints are accepted',()=>{
  assert.equal(validateLoopbackEndpoint('http://127.0.0.1:1234/v1/chat/completions').port,'1234');
  assert.throws(()=>validateLoopbackEndpoint('http://0.0.0.0:1234/v1/chat/completions'),/LOCAL_ENDPOINT_REQUIRED/);
  assert.throws(()=>validateLoopbackEndpoint('https://example.com/v1/chat/completions'),/LOCAL_ENDPOINT_REQUIRED/);
});
test('each stage has its own strict schema and a model verdict is not assumed for extraction',()=>{
  assert.equal(validateStageOutput(extraction(),'EXTRACTOR').schema_version,'dreamledger/tri-llm-extraction/v1');
  assert.equal(validateStageOutput(audit(),'GAUNTLET').risk_level,'MEDIUM');
  assert.equal(validateStageOutput(judge('MATCH'),'ELOHIM').verdict,'MATCH');
  assert.throws(()=>validateStageOutput(judge('VERIFIED_MATCH'),'ELOHIM'),/JUDGE_SCHEMA_INVALID/);
  assert.throws(()=>validateStageOutput({...audit(),risk_level:'PASS'},'GAUNTLET'),/AUDIT_SCHEMA_INVALID/);
});
test('deterministic arithmetic checks independently reconcile supplied numbers',()=>{
  const good=deterministicQuoteChecks(extraction());
  assert.equal(good.mismatch,false);
  assert.ok(good.checks.some(x=>x.id==='net_plus_gst_equals_gross'&&x.status==='PASS'));
  const bad=deterministicQuoteChecks(extraction(120));
  assert.equal(bad.mismatch,true);
});
test('approved, current context and all three model responses produce review-required receipt, never auto-approval',async()=>{
  const result=await runQuoteGauntlet({
    rawInput:'Apex Cloud NZ | CUBE Micro Diagnostic | $115.00 NZD incl GST | Excludes on-site visits',
    contextManifest:contextManifest(),apiToken:'test-token',fetchImpl:makeFetch(),
    now:()=>testNow
  });
  assert.equal(result.verdict,'MATCH');
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.equal(result.stage_results.length,3);
  assert.match(result.receipt.receipt_sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.receipt.raw_input_sha256,sha256('Apex Cloud NZ | CUBE Micro Diagnostic | $115.00 NZD incl GST | Excludes on-site visits'));
});
test('deterministic arithmetic contradiction overrides a model MATCH',async()=>{
  const result=await runQuoteGauntlet({
    rawInput:'Sample quote with inconsistent totals',
    contextManifest:contextManifest(),apiToken:'test-token',
    fetchImpl:makeFetch({gross:120}),now:()=>testNow
  });
  assert.equal(result.verdict,'MISMATCH');
  assert.equal(result.status,'QUARANTINE');
  assert.equal(result.override_reason,'DETERMINISTIC_ARITHMETIC_CONTRADICTION');
});
test('unavailable model returns no receipt and fails closed',async()=>{
  const result=await runQuoteGauntlet({
    rawInput:'sample',contextManifest:contextManifest(),apiToken:'test-token',
    fetchImpl:makeFetch({failRole:'GAUNTLET'}),now:()=>testNow
  });
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.receipt,null);
  assert.equal(result.completed_stages.length,1);
});
test('missing token and missing or stale context stop before model calls',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;throw new Error('should not call');};
  const missingToken=await runQuoteGauntlet({rawInput:'sample',contextManifest:contextManifest(),apiToken:'',fetchImpl,now:()=>testNow});
  assert.equal(missingToken.reason,'LM_API_TOKEN_REQUIRED');
  const unapproved=contextManifest();unapproved.status='DRAFT';
  const body={...unapproved};delete body.manifest_sha256;unapproved.manifest_sha256=sha256(canonicalJson(body));
  const staleContext=await runQuoteGauntlet({rawInput:'sample',contextManifest:unapproved,apiToken:'test-token',fetchImpl,now:()=>testNow});
  assert.equal(staleContext.reason,'CONTEXT_NOT_APPROVED');
  assert.equal(calls,0);
});
test('context manifest model drift blocks inference',async()=>{
  const manifest=contextManifest();
  manifest.model_ids.EXTRACTOR='unapproved-model';
  const body={...manifest};delete body.manifest_sha256;manifest.manifest_sha256=sha256(canonicalJson(body));
  const result=await runQuoteGauntlet({rawInput:'sample',contextManifest:manifest,apiToken:'test-token',fetchImpl:makeFetch(),now:()=>testNow});
  assert.match(result.reason,/CONTEXT_MODEL_DRIFT/);
  assert.equal(result.receipt,undefined);
});
