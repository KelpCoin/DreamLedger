'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configured,validate,reserve}=require('./BeckAdReservationClient');
const placement={id:'placement_nz_01',exhaust:'dreamledger',silo:'ads',canvas_id:'nz_board',x:0,y:0,width:100,height:100,canvas_width:1000,canvas_height:1000,price_minor:5000,currency:'NZD',status:'APPROVED',start_utc:'2026-11-01T00:00:00Z',end_utc:'2027-11-01T00:00:00Z'};
const order={placement,idempotency_key:'checkout_001'};
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-service-role-key-not-real'};
const rpcRow=(patch={})=>({
 reservation_id:'123e4567-e89b-42d3-a456-426614174000',
 exhaust:placement.exhaust,silo:placement.silo,canvas:placement.canvas_id,
 idempotency_key:order.idempotency_key,
 x:placement.x,y:placement.y,width:placement.width,height:placement.height,
 canvas_width:placement.canvas_width,canvas_height:placement.canvas_height,
 campaign_start:placement.start_utc,campaign_end:placement.end_utc,
 price_minor:placement.price_minor,currency:placement.currency,
 status:'HELD',hold_expires_at:'2099-01-01T00:00:00Z',...patch
});
test('fails closed without backend credential',()=>assert.throws(()=>configured({SUPABASE_URL:env.SUPABASE_URL}),/backend_unavailable/));
test('rejects invalid nonce',()=>assert.throws(()=>validate({...order,idempotency_key:'bad'}),/key_invalid/));
test('rejects namespace override',()=>assert.throws(()=>validate({...order,placement:{...placement,exhaust:'../escape'}}),/namespace_invalid/));
test('rejects out-of-bounds ad',()=>assert.throws(()=>validate({...order,placement:{...placement,x:990}}),/out_of_bounds/));
test('calls the authenticated atomic RPC',async()=>{
 let calls=0;
 const got=await reserve(order,{env,fetchImpl:async(url,opts)=>{
   calls++;assert.match(url,/\/rest\/v1\/rpc\/beck_ad_reserve_tile$/);assert.equal(opts.method,'POST');
   assert.equal(opts.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);
   assert.equal(JSON.parse(opts.body).p_key,'checkout_001');
   return {ok:true,json:async()=>(rpcRow())};
 }});
 assert.equal(calls,1);assert.equal(got.status,'HELD');
});
test('backend rejection cannot reserve',async()=>await assert.rejects(()=>reserve(order,{env,fetchImpl:async()=>({ok:false,status:400})}),/reservation_rejected/));
test('stale hold cannot reactivate on retry',async()=>await assert.rejects(()=>reserve(order,{env,fetchImpl:async()=>({ok:true,json:async()=>(rpcRow({hold_expires_at:'2000-01-01T00:00:00Z'}))})}),/not_active/));
test('network loss cannot report reserved',async()=>await assert.rejects(()=>reserve(order,{env,fetchImpl:async()=>{throw Error('timeout')}}),/network_unavailable/));
test('provider details never leaked in errors',async()=>{try{await reserve(order,{env,fetchImpl:async()=>({ok:false,status:502})})}catch(e){assert.equal(e.message.includes(env.SUPABASE_SERVICE_ROLE_KEY),false)}});

test('draft or unlabelled inventory cannot be upgraded by the adapter',()=>{
 assert.throws(()=>validate({...order,placement:{...placement,status:'DRAFT'}}),/not_approved/);
 assert.throws(()=>validate({...order,placement:{...placement,status:undefined}}),/not_approved/);
});
const rpcReply=(patch)=>reserve(order,{env,fetchImpl:async()=>({ok:true,json:async()=>rpcRow(patch)})});
test('rejects a different price even on matching idempotency key',async()=>{
 await assert.rejects(()=>rpcReply({price_minor:1}),/response_invalid/);
});
test('rejects mismatched geometry and campaign window',async()=>{
 await assert.rejects(()=>rpcReply({x:200}),/response_invalid/);
 await assert.rejects(()=>rpcReply({campaign_end:'2027-11-02T00:00:00Z'}),/response_invalid/);
});
test('rejects a wrong currency and invalid reservation identity',async()=>{
 await assert.rejects(()=>rpcReply({currency:'USD'}),/response_invalid/);
 await assert.rejects(()=>rpcReply({reservation_id:'not-a-uuid'}),/response_invalid/);
});
test('rejects incomplete or malformed RPC responses',async()=>{
 await assert.rejects(()=>rpcReply({campaign_start:undefined}),/response_invalid/);
 await assert.rejects(()=>rpcReply({hold_expires_at:'not-a-date'}),/not_active/);
});
