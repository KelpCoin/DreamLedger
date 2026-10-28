#!/usr/bin/env node
'use strict';
// Hermetic source-classifier regressions. No Stripe credentials, network,
// checkout, or external writes. This file is not a production producer.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const verifier=path.join(__dirname,'verify-stripe-checkout-contract.js');
let checks=0;
function fixture(files,expected,expectedExclusion) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'beck-checkout-static-'));
  try {
    for(const [name,body] of Object.entries(files)) {
      const out=path.join(root,name);
      fs.mkdirSync(path.dirname(out),{recursive:true});
      fs.writeFileSync(out,body,'utf8');
    }
    const p=cp.spawnSync(process.execPath,[verifier],{
      encoding:'utf8',timeout:20000,
      env:{...process.env,CHECKOUT_CONTRACT_SCAN_ROOT:root}
    });
    assert.equal(p.error,undefined);
    const proofPath=path.join(root,'data','proofs','stripe-checkout-contract-latest.json');
    assert(fs.existsSync(proofPath),'proof required');
    const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
    assert.equal(proof.status,expected,JSON.stringify({stdout:p.stdout,stderr:p.stderr,proof}));
    assert.equal(p.status,expected==='PASS'?0:1);
    assert.equal(proof.evidence_classification,'STATIC_SOURCE_CHECK_NOT_LIVE_PAYMENT_PROOF');
    if(expectedExclusion) {
      const match=proof.nonproducer_exclusions.find(x=>x.file===expectedExclusion.file);
      assert.equal(match?.reason,expectedExclusion.reason);
    }
    checks++;
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
}
// Mock-only test code is not a checkout producer.
fixture({'scripts/test_billboard_live_contract.mjs':
"const url='https://api.stripe.com/v1/checkout/sessions/fixture'; const fetchMock=()=>({status:200});"
},'PASS',{file:'scripts/test_billboard_live_contract.mjs',reason:'NONPRODUCTION_TEST'});

// A webhook that GETs Stripe line items but POSTs a refund elsewhere is
// not a checkout creator. Keep its future changes fail-closed.
const consumer=[
"async function stripe(path,init={}){return fetch('https://api.stripe.com/v1/'+path,init);}",
"async function refund(){return stripe('refunds',{method:'POST'});}",
"async function consume(s){return stripe('checkout/sessions/'+encodeURIComponent(s.id)+'/line_items?limit=100');}"
].join('\n');
const webhook='supabase/functions/dreamledger-billboard-webhook/index.ts';
fixture({[webhook]:consumer},'PASS',
  {file:webhook,reason:'LINE_ITEMS_READ_ONLY_CONSUMER'});

// Mutation of the same consumer to create sessions must revoke the exception.
fixture({[webhook]:consumer+"\nasync function create(){return fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST'});}"},'FAIL');

// A real direct checkout POST without canonical payment-intent metadata fails.
fixture({'api/checkout.js':
"await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',body:new URLSearchParams()});"},
'FAIL');

// An actual Stripe SDK session creator must be detected even without a
// literal checkout/sessions URL.
fixture({'api/sdk.js':
"await stripe.checkout.sessions.create({mode:'payment'});"},'FAIL');

// Dynamic metadata keys are not statically proven: conservative HOLD.
fixture({'api/dynamic.js':
"const keys=['product_sku','product_id','offer_id','silo','source']; const params=new URLSearchParams(); for(const key of keys){params.set('payment_intent_data[metadata]['+key+']','value');} await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',body:params});"},
'FAIL');

// Explicit canonical fields are statically established.
fixture({'api/good.js':[
"params.set('payment_intent_data[metadata][product_sku]','a');",
"params.set('payment_intent_data[metadata][product_id]','b');",
"params.set('payment_intent_data[metadata][offer_id]','c');",
"params.set('payment_intent_data[metadata][silo]','d');",
"params.set('payment_intent_data[metadata][source]','e');",
"await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',body:params});"
].join('\n')},'PASS');

console.log(JSON.stringify({status:'PASS',checks,live_stripe_calls:0,external_payment_events:0,production_mutations:0}));
