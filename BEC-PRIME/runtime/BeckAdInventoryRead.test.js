'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inventory}=require('./BeckAdInventoryRead');
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-server-only-secret-for-offline-tests'};
const now=new Date('2026-11-01T12:00:00Z');
const canvas=[{exhaust:'dreamledger',silo:'ads',canvas:'nz_board',width:1000,height:1000,booking_enabled:true}];
const slot=(id,patch={})=>({reservation_id:id,x:0,y:0,width:100,height:100,status:'PUBLISHED',
 campaign_start:'2026-01-01T00:00:00Z',campaign_end:'2027-01-01T00:00:00Z',
 hold_expires_at:'2027-01-01T00:00:00Z',...patch});
function mock(canvases=canvas,rows=[]) {
 return async(url,options)=>{
  assert.equal(options.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);
  if(url.includes('/beck_ad_canvases?'))return {ok:true,json:async()=>canvases};
  if(url.includes('/beck_ad_reservations?'))return {ok:true,json:async()=>rows};
  throw Error('unexpected_url');
 };
}
test('empty verified registered canvas has 100 free founding cells',async()=>{
 const r=await inventory({env,now,fetchImpl:mock()});
 assert.equal(r.remaining_founding_units,100);assert.equal(r.allocated_pixels,0);assert.equal(r.audience_claims_verified,false);
});
test('published cell reduces exact free footprint',async()=>{
 const r=await inventory({env,now,fetchImpl:mock(canvas,[slot('placed_01')])});
 assert.equal(r.remaining_founding_units,99);assert.equal(r.sold_pixels,10000);
 assert.deepEqual(r.unavailable_positions,[{x:0,y:0,width:100,height:100}]);
 assert.equal(r.published_positions.length,1);assert.equal(r.payment_claims_verified,false);
});
test('expired holds cannot create false scarcity',async()=>{
 const r=await inventory({env,now,fetchImpl:mock(canvas,[slot('hold_01',{status:'HELD',hold_expires_at:'2000-01-01T00:00:00Z'})])});
 assert.equal(r.remaining_founding_units,100);
});
test('live holds count as unavailable, not as paid',async()=>{
 const r=await inventory({env,now,fetchImpl:mock(canvas,[slot('hold_01',{status:'HELD'})])});
 assert.equal(r.remaining_founding_units,99);assert.equal(r.held_pixels,10000);assert.equal(r.sold_pixels,0);
});
test('unregistered/disabled canvases fail closed',async()=>{
 await assert.rejects(()=>inventory({env,now,fetchImpl:mock([],[])}),/unverified/);
 await assert.rejects(()=>inventory({env,now,fetchImpl:mock([{...canvas[0],booking_enabled:false}],[])}),/unverified/);
});
test('overlapping data fails closed rather than invent availability',async()=>{
 await assert.rejects(()=>inventory({env,now,fetchImpl:mock(canvas,[slot('placed_01'),slot('placed_02')])}),/unverified/);
});
test('truncated provider rows fail closed',async()=>{
 await assert.rejects(()=>inventory({env,now,fetchImpl:mock(canvas,Array.from({length:1000},(_,i)=>slot('n'+i)))}),/unverified/);
});
test('network loss fails closed',async()=>await assert.rejects(()=>inventory({env,now,fetchImpl:async()=>{throw Error('network')}}),/unverified/));


test('future confirmed booking is included in permanent footprint',async()=>{
 let queryUrl='';
 const fetchImpl=async(url)=>{
   if(url.includes('/beck_ad_canvases?'))return {ok:true,json:async()=>canvas};
   queryUrl=url;
   return {ok:true,json:async()=>[slot('future_01',{campaign_start:'2026-12-01T00:00:00Z',campaign_end:'2999-01-01T00:00:00Z'})]};
 };
 const r=await inventory({env,now,fetchImpl});
 assert.equal(r.remaining_founding_units,99);
 assert.equal(queryUrl.includes('campaign_start='),false);
 assert.equal(r.unavailable_positions.length,1);
});
