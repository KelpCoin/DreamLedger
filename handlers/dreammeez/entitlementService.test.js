'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService,INSERT}=require('./entitlementService.js');
const user='u_0123456789abcdef01234567';
const grant={accountId:user,itemId:'chrome-boots',sku:'CHROME-BOOTS',paymentId:'checkout:cs_test_evidence_12345678'};
test('unverified or absent payment never mints ownership',async()=>{
 const calls=[],svc=createService(async(sql,args)=>{calls.push([sql,args]);return [];});
 const r=await svc.grantEntitlement(grant);
 assert.equal(r.granted,false);
 assert.equal(r.state,'HOLD_PAYMENT_OR_IDENTITY_NOT_VERIFIED');
 assert.deepEqual(calls[0][1],[user,'chrome-boots','CHROME-BOOTS',grant.paymentId]);
});
test('grant SQL requires paid live event, settled matched order and exact silo/amount',()=>{
 for(const fragment of ["p.status='SETTLED_VERIFIED'","o.status='SETTLED_VERIFIED'",
 "p.livemode=TRUE","e.livemode=TRUE","o.buyer_reference=$1",
 "f.silo_id='dreammeez'","p.amount_cents=f.price_cents","ON CONFLICT DO NOTHING"]){
  assert.ok(INSERT.includes(fragment),fragment);
 }
});
test('fake account or item/payment IDs rejected before SQL',async()=>{
 let calls=0;const svc=createService(async()=>{calls++;return [];});
 await assert.rejects(svc.grantEntitlement({...grant,accountId:'u_forged'}),/INVALID_AUTHENTICATED_PRINCIPAL/);
 await assert.rejects(svc.grantEntitlement({...grant,itemId:'bad item'}),/INVALID_ITEM/);
 await assert.rejects(svc.grantEntitlement({...grant,paymentId:'pi_client_supplied'}),/INVALID_PAYMENT_EVIDENCE_KEY/);
 assert.equal(calls,0);
});
test('server readonly ownership query uses account principal',async()=>{
 const svc=createService(async(sql,args)=>sql.startsWith('SELECT')?[{item_id:'chrome-boots'}]:[]);
 assert.deepEqual(await svc.getOwnedItemIds(user),['chrome-boots']);
 assert.equal(await svc.hasEntitlement(user,'chrome-boots'),true);
 assert.equal(await svc.hasEntitlement(user,'neon-shades'),false);
});
test('backend payment grant is NOT exposed on website or dispatcher',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const api=fs.readFileSync(path.join(__dirname,'..','..','api','[...route].ts'),'utf8');
 assert.doesNotMatch(api,/dreammeez\/grant|grantEntitlement/);
});
