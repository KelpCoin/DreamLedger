'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {once}=require('node:events');
const gate=require('./PaidDownloadGate');

const signingSecret='local-test-signing-secret-not-for-any-production-use';
const webhookSecret='whsec_fake_for_deterministic_local_tests';
const now=()=>Date.now();
function stripeFixture(overrides={}) {
  const event={id:'evt_Abc12345678',livemode:false,type:'checkout.session.completed',
    data:{object:{id:'cs_test_ABC123456789',payment_status:'paid',mode:'payment',
      livemode:false,payment_link:gate.EXPECTED_LINK,amount_total:7900,currency:'nzd'}}};
  if(overrides.event) Object.assign(event,overrides.event);
  if(overrides.session) Object.assign(event.data.object,overrides.session);
  const rawBody=JSON.stringify(event);
  const t=Math.floor(now()/1000);
  const sig=crypto.createHmac('sha256',webhookSecret).update(t+'.'+rawBody).digest('hex');
  return {rawBody,stripeSignature:'t='+t+',v1='+sig,webhookSecret,expectedLivemode:false};
}
function issue(x={}){return gate.issueFromSignedStripeWebhook({...stripeFixture(x),downloadSecret:signingSecret});}
test('signed Stripe paid event grants bounded private entitlement, never delivered status',()=>{
  const result=issue();
  assert.equal(result.delivery_state,'ENTITLEMENT_ISSUED_NOT_DELIVERED');
  const c=gate.verifyToken(result.token,{downloadSecret:signingSecret,expectedLivemode:false});
  assert.equal(c.sku,gate.SKU);
  assert.equal(c.order_id,'cs_test_ABC123456789');
  assert.equal(c.exp-c.iat,900);
});
test('wrong Stripe webhook signature cannot issue a grant',()=>{
  const input=stripeFixture();input.stripeSignature='t='+Math.floor(now()/1000)+',v1='+'0'.repeat(64);
  assert.throws(()=>gate.issueFromSignedStripeWebhook({...input,downloadSecret:signingSecret}),/Invalid Stripe signature/);
});
test('no-cost and unpaid orders do not unlock the paid SKU',()=>{
  for(const payment_status of ['no_payment_required','unpaid']){
    assert.throws(()=>issue({session:{payment_status}}),/NO_VERIFIED_PAYMENT/);
  }
});
test('wrong link, amount, currency, mode or event all fail',()=>{
  for(const session of [
    {payment_link:'plink_attacker'}, {amount_total:0}, {amount_total:9000},
    {currency:'usd'}, {mode:'subscription'}]){
    assert.throws(()=>issue({session}));
  }
  assert.throws(()=>issue({event:{type:'charge.succeeded'}}),/STRIPE_EVENT_NOT_PAID_CHECKOUT/);
  assert.throws(()=>issue({event:{livemode:true}}),/WRONG_STRIPE_MODE/);
});
test('live/test account boundaries must match exact event and bearer token',()=>{
  const result=issue();
  assert.throws(()=>gate.verifyToken(result.token,{downloadSecret:signingSecret,expectedLivemode:true}),/DOWNLOAD_ENTITLEMENT_INVALID/);
});
test('altered or expired download token cannot be redeemed',()=>{
  const r=issue();const [a,b]=r.token.split('.');
  assert.throws(()=>gate.verifyToken(a+'.'+'A'+b.slice(1),{downloadSecret:signingSecret,expectedLivemode:false}));
  assert.throws(()=>gate.verifyToken(r.token,{downloadSecret:signingSecret,expectedLivemode:false,
    nowMs:(r.claims.exp+1)*1000}),/DOWNLOAD_ENTITLEMENT_INVALID_OR_EXPIRED/);
  assert.throws(()=>gate.verifyToken(r.token,{downloadSecret:'another-test-secret-signing-key-string',expectedLivemode:false}),/INVALID_DOWNLOAD_TOKEN_SIGNATURE/);
});
test('private assets cannot be stored anywhere in the public source repository',()=>{
  assert.throws(()=>gate.privateAssetPath(path.join(__dirname,'..','..','public')),/ASSET_MUST_BE_OUTSIDE_PUBLIC_REPOSITORY/);
  assert.throws(()=>gate.privateAssetPath('public/downloads'),/PRIVATE_ASSET_DIR_REQUIRED/);
});
test('paid-only route never gives bytes without token; can stream outside public checkout',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'beck-secure-download-'));
  const payload=Buffer.from('CANARY_CONTENT_FOR_LOCAL_TEST');
  fs.writeFileSync(path.join(dir,'DISCORD-WEBHOOK-STARTER-KIT-001.zip'),payload);
  const streamEvents=[];
  const server=http.createServer((req,res)=>gate.handle(req,res,{
    downloadSecret:signingSecret,privateDir:dir,expectedLivemode:false,
    onStreamFinished:r=>streamEvents.push(r)}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const url='http://127.0.0.1:'+server.address().port;
    const missing=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'none'})});
    assert.equal(missing.status,403);
    const valid=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({token:issue().token})});
    assert.equal(valid.status,200);
    assert.equal(valid.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(Buffer.from(await valid.arrayBuffer()),payload);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(streamEvents.length,1);
    assert.equal(streamEvents[0].delivery_state,'STREAM_FINISHED_CUSTOMER_RECEIPT_UNKNOWN');
    const wrong=await fetch(url,{method:'GET'});
    assert.equal(wrong.status,405);
  }finally{server.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('missing private storage fails closed without giving bytes',async()=>{
  const server=http.createServer((req,res)=>gate.handle(req,res,{downloadSecret:signingSecret,privateDir:null,expectedLivemode:false}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{const r=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',body:'{}'});assert.equal(r.status,503);}
  finally{server.close();}
});
