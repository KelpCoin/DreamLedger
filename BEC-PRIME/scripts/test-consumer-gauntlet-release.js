'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {consumerRelease,reviewBoundPublishIntent,stableJSON}=require('../gauntlet/CandidateGauntlet');
const product={id:'FIXTURE-PRINTABLE',silo:'digital-products',name:'Original illustration',price:9,status:'published',description:'Original test illustration'};
const productHash=crypto.createHash('sha256').update(JSON.stringify(product)).digest('hex');
const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
const publicPem=publicKey.export({type:'spki',format:'pem'});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const identifiers=['rights_confirmed','claims_source_verified','specific_customer_value','silo_isolated','fulfillment_end_to_end_tested','marketplace_policy_checked'];
function makeReceipt(mod={}) {
  const base={
    schema:'BECK/CONSUMER-GAUNTLET/v1',
    issuer_id:'beck-gauntlet',
    checked_at:new Date().toISOString(),
    verdict:'PASS',product_id:product.id,product_sha256:productHash,
    artifact_sha256:sha('original-artifact-fixture'),
    checks:identifiers.map(id=>({id,status:'PASS',severity:'INFO',evidence_sha256:sha(id)})),
    ...mod
  };
  const signature=crypto.sign(null,Buffer.from(stableJSON(base)),privateKey).toString('base64');
  return {...base,signature};
}
const keys={'beck-gauntlet':publicPem};
test('verified signed reviewed product may reach the separate preaction boundary only',()=>{
  const receipt=makeReceipt();
  const v=consumerRelease(product,receipt,keys);
  assert.equal(v.status,'PASS');
  assert.equal(v.human_approval,'SEPARATE_PREACTION_SIGNATURE_REQUIRED');
  assert.equal(v.economic_proof,'NOT_ESTABLISHED');
  let requested=null;
  const fakePreaction={evaluate:(request)=>{requested=request;return {decision:'DENY',reason:'HUMAN_APPROVAL_MISSING',executable:false};}};
  const result=reviewBoundPublishIntent(product,receipt,keys,fakePreaction,{job_id:'job-123',channel:'own_store'});
  assert.equal(result.decision,'DENY');
  assert.equal(requested.action,'publish_listing');
  assert.equal(requested.silo_id,'digital-products');
  assert.equal(requested.payload.gauntlet_receipt_sha256,v.gauntlet_receipt_sha256);
  assert.equal(requested.payload.product_sha256,productHash);
});
test('no receipt, no key, malformed reports and unknown signer block',()=>{
  assert.equal(consumerRelease(product,null,keys).status,'BLOCK');
  assert.equal(consumerRelease(product,makeReceipt(),{}).status,'BLOCK');
  assert.equal(consumerRelease(product,makeReceipt({issuer_id:'outsider'}),keys).status,'BLOCK');
  assert.equal(consumerRelease(product,makeReceipt({verdict:'HOLD'}),keys).status,'BLOCK');
});
test('tampering with report or product after reviewer signs fails closed',()=>{
  const report=makeReceipt();
  assert.equal(consumerRelease({...product,price:11},report,keys).status,'BLOCK');
  const changed={...report,artifact_sha256:sha('not-the-original')};
  assert.equal(consumerRelease(product,changed,keys).status,'BLOCK');
});
test('HIGH canary finding blocks even when report erroneously claims PASS',()=>{
  const c=identifiers.map(id=>({id,status:'PASS',severity:'INFO',evidence_sha256:sha(id)}));
  c.push({id:'invented_delivery_claim',status:'WARN',severity:'HIGH',evidence_sha256:sha('false')});
  const receipt=makeReceipt({checks:c});
  const verdict=consumerRelease(product,receipt,keys);
  assert.equal(verdict.status,'BLOCK');
  assert.ok(verdict.failures.includes('HIGH_OR_FAILED_GAUNTLET_FINDING'));
});
test('missing rights or completed fulfillment evidence blocks',()=>{
  const checks=identifiers.filter(id=>id!=='fulfillment_end_to_end_tested').map(id=>({id,status:'PASS',severity:'INFO',evidence_sha256:sha(id)}));
  assert.equal(consumerRelease(product,makeReceipt({checks}),keys).status,'BLOCK');
  const bad=identifiers.map(id=>({id,status:id==='rights_confirmed'?'FAIL':'PASS',severity:'INFO',evidence_sha256:sha(id)}));
  assert.equal(consumerRelease(product,makeReceipt({checks:bad}),keys).status,'BLOCK');
});
test('old report blocks and preaction cannot be reached on unsigned quality evidence',()=>{
  const old=makeReceipt({checked_at:'2025-01-01T00:00:00Z'});
  assert.equal(consumerRelease(product,old,keys).status,'BLOCK');
  let calls=0;
  const adapter={evaluate:()=>{calls++;return {decision:'AUTHORIZED_NOT_EXECUTED'};}};
  const answer=reviewBoundPublishIntent(product,makeReceipt({verdict:'FAIL'}),keys,adapter,{job_id:'j1'});
  assert.equal(answer.decision,'DENY');
  assert.equal(calls,0);
});
test('missing side effect adapter blocks regardless of green signed Gauntlet',()=>{
  assert.equal(reviewBoundPublishIntent(product,makeReceipt(),keys,null,{job_id:'j1'}).decision,'DENY');
});
