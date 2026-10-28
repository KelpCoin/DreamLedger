'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {writeProofArtifacts, verifyStripeSignature} = require('../lib/stripeWebhookProof');

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'beck-proof-redteam-'));
  const dirs={ledger:path.join(root,'ledger'),proofs:path.join(root,'proofs'),firstProof:path.join(root,'proofs','FIRST_PAYMENT_PROOF.json')};
  fs.mkdirSync(dirs.ledger,{recursive:true});
  fs.mkdirSync(dirs.proofs,{recursive:true});
  process.env.TAX_LEDGER_PATH=path.join(root,'tax','tax.csv');
  const transactionId='cs_live_redteam_001';
  const tx={transaction_id:transactionId,product_id:'QUOTE-COMPARE-49',offer_id:null,amount_total:4900,currency:'nzd',stripe_payment_intent:'pi_live_redteam',payment_link_id:'plink_redteam',payment_status:'paid'};
  const proof={transaction_id:transactionId,amount_total:4900,currency:'nzd',payment_status:'paid',delivery_status:'PENDING',payment_received:true};
  return {root,dirs,transactionId,records:{tx,proof,transactionId,taxTag:{gst_amount_minor:639}}};
}
function cleanup(f){fs.rmSync(f.root,{recursive:true,force:true});}

test('payment proof records pending delivery and repeats without duplicate tax',()=>{
  const f=fixture();
  try{
    const first=writeProofArtifacts(f.records,f.dirs);
    assert.equal(first.ok,true);
    assert.equal(first.idempotent,false);
    assert.equal(first.fulfilled,false);
    assert.equal(first.delivery_status,'PENDING');
    assert.equal(first.first_payment_proof_written,true);
    const retry=writeProofArtifacts(f.records,f.dirs);
    assert.equal(retry.idempotent,true);
    assert.equal(retry.fulfilled,false);
    assert.equal(retry.first_payment_proof_written,false);
    assert.equal(retry.tax_ledger.idempotent,true);
    const csv=fs.readFileSync(process.env.TAX_LEDGER_PATH,'utf8');
    assert.equal(csv.split(f.transactionId).length-1,1);
  }finally{cleanup(f);}
});
test('partial crash with transaction only is repaired on next delivery',()=>{
  const f=fixture();
  try{
    fs.writeFileSync(path.join(f.dirs.ledger,f.transactionId+'.json'),JSON.stringify(f.records.tx));
    const repaired=writeProofArtifacts(f.records,f.dirs);
    assert.equal(repaired.idempotent,true);
    assert.equal(repaired.fulfilled,false);
    assert.equal(fs.existsSync(path.join(f.dirs.proofs,f.transactionId+'.json')),true);
    assert.equal(fs.existsSync(process.env.TAX_LEDGER_PATH),true);
  }finally{cleanup(f);}
});
test('same session ID with changed amount fails closed, preserves original receipt',()=>{
  const f=fixture();
  try{
    writeProofArtifacts(f.records,f.dirs);
    const before=fs.readFileSync(path.join(f.dirs.ledger,f.transactionId+'.json'),'utf8');
    const altered=structuredClone(f.records);
    altered.tx.amount_total=5900;
    assert.throws(()=>writeProofArtifacts(altered,f.dirs),/STRIPE_TRANSACTION_IDENTITY_COLLISION_AMOUNT_TOTAL/);
    assert.equal(fs.readFileSync(path.join(f.dirs.ledger,f.transactionId+'.json'),'utf8'),before);
  }finally{cleanup(f);}
});
test('in-flight or stale per-session claim cannot grant or regenerate proof',()=>{
  const f=fixture();
  try{
    const claim=path.join(f.dirs.ledger,'.'+f.transactionId+'.processing');
    fs.mkdirSync(claim);
    assert.throws(()=>writeProofArtifacts(f.records,f.dirs),/CLAIM_BUSY_OR_STALE/);
    assert.equal(fs.existsSync(path.join(f.dirs.proofs,f.transactionId+'.json')),false);
  }finally{cleanup(f);}
});
test('different-session concurrent tax-writer claim fails closed',()=>{
  const f=fixture();
  try{
    const lock=path.join(f.dirs.ledger,'.tax-ledger-processing');
    fs.mkdirSync(lock);
    assert.throws(()=>writeProofArtifacts(f.records,f.dirs),/TAX_LEDGER_BUSY_OR_STALE/);
    assert.equal(fs.existsSync(process.env.TAX_LEDGER_PATH),false);
    fs.rmdirSync(lock);
    const recovery=writeProofArtifacts(f.records,f.dirs);
    assert.equal(recovery.idempotent,true);
    assert.equal(recovery.fulfilled,false);
  }finally{cleanup(f);}
});
test('reject path traversal and non-session IDs',()=>{
  const f=fixture();
  try{
    assert.throws(()=>writeProofArtifacts({...f.records,transactionId:'../../other'},f.dirs),/INVALID_STRIPE_SESSION_ID/);
    assert.throws(()=>writeProofArtifacts({...f.records,transactionId:'evt_live_001'},f.dirs),/INVALID_STRIPE_SESSION_ID/);
  }finally{cleanup(f);}
});
test('reject invalid Stripe timestamp, even with matching HMAC',()=>{
  const raw='{"id":"evt_fake"}',secret='whsec_redteam_test_only',ts='NaN';
  const signature=crypto.createHmac('sha256',secret).update(ts+'.'+raw).digest('hex');
  assert.throws(()=>verifyStripeSignature(raw,'t='+ts+',v1='+signature,secret),/Invalid Stripe timestamp/);
});
