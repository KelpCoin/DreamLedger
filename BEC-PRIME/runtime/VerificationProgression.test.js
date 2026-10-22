'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('./VerificationProgression');
const template={template_id:'mtg-deck-diagnostic',silo_id:'SILO_MTG'};
const observed={kind:'TEST',receipt_id:'test_01',template_id:template.template_id,silo_id:template.silo_id,status:'VERIFIED',artifact_sha256:'a'.repeat(64),source_reference:'sha:01'};
test('unproven capabilities are only candidates',()=>assert.equal(p.evaluate(template).state,'CANDIDATE'));
test('passing a test is not revenue',()=>{
 const result=p.evaluate(template,[observed]);
 assert.equal(result.state,'TESTED');assert.equal(result.verified_commercial_outcomes,0);assert.equal(result.inferred_revenue_nzd,null);
});
test('retrievable delivery is its own evidence state',()=>assert.equal(p.evaluate(template,[{...observed,kind:'FULFILLMENT',delivery_retrievable:true}]).state,'DELIVERY_PROVEN'));
test('commercial provenance requires settled payment, buyer, delivery and reconciliation',()=>{
 const commercial={...observed,kind:'COMMERCIAL',settled_payment_verified:true,external_buyer_verified:true,delivery_retrievable:true};
 assert.equal(p.evaluate(template,[commercial]).verified_commercial_outcomes,0);
 assert.equal(p.evaluate(template,[{...commercial,reconciled:true}]).state,'REVENUE_PROVEN');
});
test('cross-silo proof cannot promote another capability',()=>assert.equal(p.evaluate(template,[{...observed,silo_id:'SILO_OTHER'}]).state,'CANDIDATE'));
test('community deliveries are deduplicated, never transferable financial rewards',()=>{
 const one={...observed,kind:'FULFILLMENT',delivery_retrievable:true};
 const result=p.communityScore('SILO_MTG',[one,one]);
 assert.equal(result.verified_deliveries,1);assert.equal(result.tradable_reward,null);
 assert.equal(result.leaderboard_publication_authorized,false);
});
