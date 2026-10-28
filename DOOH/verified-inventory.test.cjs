'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {verifyInventory,planCampaign,verifyPlaybackProof,payloadProof}=require('./verified-inventory.cjs');
const when=new Date('2026-10-29T10:00:00.000Z');
const screen={
 screen_id:'screen-nz-akl-001',region:'NZ',publisher_id:'publisher-nz-001',
 partner_authorization_id:'contract-001',status:'VERIFIED_AVAILABLE',
 inventory_receipt_sha256:'a'.repeat(64),
 verified_at:'2026-10-29T09:00:00.000Z',expires_at:'2026-10-30T09:00:00.000Z',
 width_px:1920,height_px:1080,min_duration_ms:10000
};
test('untrusted web canvas, sandbox and missing publisher proof cannot count as a real screen',()=>{
 assert.equal(verifyInventory(null,when).eligible,false);
 assert.equal(verifyInventory({...screen,partner_authorization_id:''},when).reason,'PUBLISHER_AUTHORIZATION_REQUIRED');
 assert.equal(verifyInventory({...screen,status:'SANDBOX'},when).reason,'NOT_VERIFIED_AVAILABLE');
 assert.equal(verifyInventory({...screen,verified_at:'2026-10-26T10:00:00.000Z'},when).eligible,false);
 assert.equal(verifyInventory({...screen,inventory_receipt_sha256:''},when).eligible,false);
 assert.equal(verifyInventory({...screen,region:'NZ'},when).eligible,true);
});
test('zero verified inventory means zero bookable inventory for NZ and worldwide',()=>{
 const q={region:'NZ',budget_minor:0,creative_sha256:'b'.repeat(64),
  duration_ms:10000,approved_creative:true,inventory:[]};
 const out=planCampaign(q,when);
 assert.equal(out.status,'HOLD');
 assert.equal(out.reason,'NO_VERIFIED_PHYSICAL_INVENTORY');
 assert.deepEqual(out.eligible_screens,[]);
 assert.equal(out.spend_authorized,false);
 assert.equal(out.booking_created,false);
 const candidate=planCampaign({...q,inventory:[screen]},when);
 assert.equal(candidate.status,'REVIEW_REQUIRED');
 assert.deepEqual(candidate.eligible_screens,['screen-nz-akl-001']);
 assert.equal(candidate.impressions_verified,0);
 assert.equal(candidate.booking_created,false);
 assert.deepEqual(planCampaign({...q,region:'AU',inventory:[screen]},when).eligible_screens,[]);
});
test('art has to be explicitly approved before matching to screen inventory',()=>{
 const out=planCampaign({region:'NZ',budget_minor:5000,creative_sha256:'c'.repeat(64),
  duration_ms:10000,approved_creative:false,inventory:[screen]},when);
 assert.equal(out.reason,'UNAPPROVED_CREATIVE');
 assert.deepEqual(out.eligible_screens,[]);
});
test('signed proof requires publisher authorization, tamper rejection and no inferred revenue',()=>{
 const pair=crypto.generateKeyPairSync('ed25519');
 const pub=pair.publicKey.export({type:'spki',format:'pem'});
 const proof={proof_id:'proof-001',campaign_id:'campaign-001',screen_id:screen.screen_id,
   publisher_id:screen.publisher_id,played_at:'2026-10-29T09:59:00.000Z',
   duration_ms:10000,creative_sha256:'d'.repeat(64)};
 proof.signature_base64=crypto.sign(null,Buffer.from(payloadProof(proof)),pair.privateKey).toString('base64');
 const env={proof,public_key_pem:pub,authorized_publisher_id:screen.publisher_id,
  authorized_screens:[screen.screen_id],now:when};
 const signed=verifyPlaybackProof(env);
 assert.equal(signed.verified,true);
 assert.match(signed.note,/independent provider reconciliation/);
 assert.equal(verifyPlaybackProof({...env,proof:{...proof,duration_ms:11000}}).verified,false);
 assert.equal(verifyPlaybackProof({...env,authorized_screens:['other-screen']}).verified,false);
 assert.equal(verifyPlaybackProof({...env,authorized_publisher_id:'fake-operator'}).verified,false);
 assert.equal(verifyPlaybackProof({...env,now:new Date('2026-11-05T00:00:00.000Z')}).verified,false);
});
