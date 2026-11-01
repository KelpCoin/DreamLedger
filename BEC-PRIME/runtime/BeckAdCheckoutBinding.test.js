'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bindCheckout}=require('./BeckAdCheckoutBinding');
const id='11111111-1111-4111-8111-111111111111';
const session='cs_test_local_only_01';
const hash='a'.repeat(64);
const args={reservation_id:id,session_id:session,expires_at:'2099-01-01T00:00:00Z',
 title:'A real creative',destination_url:'https://example.com/landing',creative_sha256:hash};
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-service-role-key-local-tests'};
test('rejects session without reservation UUID',async()=>{
 await assert.rejects(()=>bindCheckout({...args,reservation_id:'not-a-uuid'},{env}),/binding_unverified/);
});
test('never calls database without the service role secret',async()=>{
 await assert.rejects(()=>bindCheckout(args,{env:{SUPABASE_URL:env.SUPABASE_URL},fetchImpl:async()=>{throw Error('unexpected')}}),/backend_unavailable/);
});
test('matches checkout to the exact bound reservation',async()=>{
 const r=await bindCheckout(args,{env,fetchImpl:async(url,opts)=>{
   assert.match(url,/\/rpc\/beck_ad_bind_checkout$/);
   assert.equal(opts.method,'POST');
   assert.equal(opts.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);
   assert.deepEqual(JSON.parse(opts.body),{p_reservation_id:id,p_session_id:session,p_session_expires_at:args.expires_at,
    p_title:args.title,p_destination_url:args.destination_url,p_creative_sha256:hash});
   return {ok:true,json:async()=>({reservation_id:id,checkout_session_id:session,status:'HELD',creative_manifest_sha256:hash,creative_review_status:'PENDING_REVIEW',hold_expires_at:'2099-01-02T00:00:00Z'})};
 }});
 assert.equal(r.linked,true);
});
test('mismatched returned session cannot be accepted',async()=>{
 await assert.rejects(()=>bindCheckout(args,{env,fetchImpl:async()=>({ok:true,json:async()=>({
 reservation_id:id,checkout_session_id:'cs_test_different',status:'HELD',creative_manifest_sha256:hash,creative_review_status:'PENDING_REVIEW',hold_expires_at:'2099-01-01T00:00:00Z'})})}),/binding_unverified/);
});
test('database network failure cannot report linked',async()=>{
 await assert.rejects(()=>bindCheckout(args,{env,fetchImpl:async()=>{throw Error('timeout')}}),/binding_unverified/);
});
test('expired hold cannot be treated as linked',async()=>{
 await assert.rejects(()=>bindCheckout(args,{env,fetchImpl:async()=>({ok:true,json:async()=>({
 reservation_id:id,checkout_session_id:session,status:'HELD',creative_manifest_sha256:hash,creative_review_status:'PENDING_REVIEW',hold_expires_at:'2001-01-01T00:00:00Z'})})}),/binding_unverified/);
});

test('mismatched creative digest must not release checkout',async()=>{
 await assert.rejects(()=>bindCheckout(args,{env,fetchImpl:async()=>({ok:true,json:async()=>({
  reservation_id:id,checkout_session_id:session,status:'HELD',
  creative_manifest_sha256:'b'.repeat(64),creative_review_status:'PENDING_REVIEW',
  hold_expires_at:'2099-01-02T00:00:00Z'
 })})}),/binding_unverified/);
});
