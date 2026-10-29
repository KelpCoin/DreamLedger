'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect,probe,QUERY}=require('./silo-health');
const row={silo_id:'baby-kids',silo_state:'draft',marked_published:0,stock_attested:0,
 pending_intake:2,live_holds:0,expired_holds:0,pending_community:1,
 published_community:0,runtime_is_attestation_owner:true};
test('owner role separation is mandatory before clone release',()=>{
 const r=inspect(row);
 assert.equal(r.state,'HOLD_UNSEPARATED_VERIFIER_AUTHORITY');
 assert.equal(r.proof.verifier_writer_separated,false);
 assert.equal(r.clone_ready,false);
});
test('stock without attestation is not usable commerce evidence',()=>{
 const r=inspect({...row,marked_published:3,stock_attested:1,runtime_is_attestation_owner:false});
 assert.equal(r.state,'HOLD_UNATTESTED_PUBLISHED_STOCK');
});
test('good stock and a separate verifier do not prove settlement',()=>{
 const r=inspect({...row,runtime_is_attestation_owner:false});
 assert.equal(r.state,'HOLD_ECONOMIC_LOOP_UNVERIFIED');
 assert.equal(r.proof.independently_settled_paid_orders,null);
});
test('unknown silo remains unknown',async()=>{
 const r=await probe('community-art',async()=>[]);
 assert.equal(r.state,'UNKNOWN_SILO');
});
test('any domain is parameterized and private metrics are scoped',async()=>{
 const r=await probe('baby-kids',async(sql,args)=>{
  assert.deepEqual(args,['baby-kids']);
  assert.match(sql,/marketplace.silo_contracts/);
  return [row];
 });
 assert.equal(r.metrics.pending_intake,2);
 assert.doesNotMatch(QUERY,/silo_id='mtg'/);
});
test('invalid input and corrupt numbers are rejected',async()=>{
 await assert.rejects(probe('../bad',async()=>[]),/INVALID_SILO/);
 assert.throws(()=>inspect({...row,pending_intake:'bad'}),/INVALID_HEALTH_DATA/);
});
