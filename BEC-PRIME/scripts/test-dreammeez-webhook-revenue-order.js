'use strict';
// Synthetic local webhook replay test. No real Stripe payment or public writes.
// Single-process concurrency is not a substitute for the transactional Neon inbox.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'dreammeez-webhook-test-'));
process.env.DREAMIEZ_DATA_DIR=root;
process.env.LEDGER_DATA_DIR=path.join(root,'transactions');
process.env.PROOF_DATA_DIR=path.join(root,'proofs');
process.env.FIRST_PAYMENT_PROOF_PATH=path.join(root,'proofs','first-payment-proof.json');
process.env.STRIPE_WEBHOOK_SECRET='whsec_synthetic_fixture';
fs.writeFileSync(path.join(root,'cosmetics.json'),JSON.stringify([
 {id:'cape',product_id:'CAPE',name:'Cape',price_nzd:10},
 {id:'cosmic-hoodie',product_id:'COSMIC-HOODIE',name:'Cosmic Hoodie',price_nzd:5},
 {id:'chrome-boots',product_id:'CHROME-BOOTS',name:'Chrome Boots',price_nzd:9}
]));
fs.writeFileSync(path.join(root,'users.json'),JSON.stringify([
 {id:'verified',email:'verified@example.org',email_verified:true,cosmetics:[]}
]));
const handler=require('../routes/marketplaceWebhook');
function makeEvent(id,session,sku){return {id,type:'checkout.session.completed',livemode:true,data:{object:{id:session.id,livemode:session.livemode??true,payment_status:'paid',currency:'nzd',amount_total:session.amount,metadata:{dreamledger_sku:sku,fulfillment:'dreammeez_entitlement'},customer_details:{email:session.email}}}};}
function jsonLines(file){return fs.existsSync(file)?fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse):[];}
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
async function main(){
 const server=http.createServer((req,res)=>{Promise.resolve(handler.handle(req,res)).then(x=>{if(!x.handled&&!res.writableEnded){res.statusCode=404;res.end();}}).catch(err=>{if(!res.headersSent)res.statusCode=500;res.end(err.message);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const endpoint='http://127.0.0.1:'+server.address().port+'/webhook';
 async function send(event){const body=JSON.stringify(event),t=Math.floor(Date.now()/1000),sig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(t+'.'+body).digest('hex');const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':'t='+t+',v1='+sig},body});return {status:res.status,result:await res.json()};}
 try {
  const pending=makeEvent('evt_fixture_pending',{id:'cs_fixture_pending',email:'future@example.org',amount:1000},'CAPE');
  const p=await send(pending);
  assert.equal(p.status,200);assert.equal(p.result.fulfilled,false);assert.equal(p.result.entitlement_status,'PENDING_ACCOUNT');
  const journals=path.join(process.env.LEDGER_DATA_DIR,'journal-entries.jsonl');
  assert.equal(jsonLines(journals).filter(x=>x.journal_id==='JE-PAY-cs_fixture_pending').length,1);
  assert.equal(jsonLines(journals).filter(x=>x.journal_id.startsWith('JE-REV')).length,0);
  let proof=readJSON(path.join(process.env.PROOF_DATA_DIR,'cs_fixture_pending.json'));
  assert.equal(proof.status,'PENDING_ACCOUNT');assert.equal(proof.ledger_status,'DEFERRED_AWAITING_ACCOUNT');
  const pair=await Promise.all([send(pending),send(pending)]);
  assert.ok(pair.every(x=>x.status===200));
  assert.equal(jsonLines(journals).filter(x=>x.journal_id==='JE-PAY-cs_fixture_pending').length,1);
  assert.equal(readJSON(path.join(root,'paid-entitlements.json')).length,1);
  // Wrong price and testmode must be rejected before changing financial state.
  const wrong=makeEvent('evt_wrong_price',{id:'cs_wrong_price',email:'verified@example.org',amount:10},'CAPE');
  assert.equal((await send(wrong)).status,400);
  const mode=makeEvent('evt_test_mode',{id:'cs_test_mode',email:'verified@example.org',amount:500,livemode:false},'COSMIC-HOODIE');
  assert.equal((await send(mode)).status,400);
  assert.equal(jsonLines(journals).length,1);
  // Only a verified account gets a local earned-revenue record.
  const granted=makeEvent('evt_granted',{id:'cs_granted',email:'verified@example.org',amount:500},'COSMIC-HOODIE');
  const g=await send(granted);assert.equal(g.status,200);assert.equal(g.result.fulfilled,true);
  assert.equal(readJSON(path.join(root,'users.json'))[0].cosmetics.includes('cosmic-hoodie'),true);
  assert.equal(jsonLines(journals).filter(x=>x.journal_id==='JE-REV-FUL-cs_granted').length,1);
  assert.equal(readJSON(path.join(process.env.PROOF_DATA_DIR,'cs_granted.json')).status,'PASS');
  assert.equal((await send(granted)).status,200);
  assert.equal(jsonLines(journals).filter(x=>x.journal_id==='JE-REV-FUL-cs_granted').length,1);
  console.log(JSON.stringify({status:'PASS',mode:'SYNTHETIC_LOCAL_ONLY',pending_deferred:true,wrong_price_rejected:true,test_mode_rejected:true,duplicate_event_dedup_local:true,verified_entitlement_granted:true,verified_revenue_claimed_nzd:0}));
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
