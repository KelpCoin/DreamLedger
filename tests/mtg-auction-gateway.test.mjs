// Exercise the real Vercel MTG gateway module without any cloud credentials.
// No network access, payments or account mutations.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const source=await readFile(new URL('../handlers/mtg-auction-v2.ts',import.meta.url),'utf8');
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY};
const originalFetch=globalThis.fetch;
const root='https://dreamledger.org/api/mtg-auction?action=';
function request(action,options={}) {
 const opts={method:options.method||'GET',headers:options.headers||{}};
 if('body'in options){opts.body=JSON.stringify(options.body);opts.headers['content-type']='application/json'}
 return new Request(root+action,opts);
}
async function result(request){const r=await handler(request);return {status:r.status,data:await r.json(),headers:r.headers}}
const apiKey='test-publishable-public-only';
function setup(){
 process.env.SUPABASE_URL='https://example.supabase.co';
 process.env.SUPABASE_ANON_KEY=apiKey;
 delete process.env.SUPABASE_PUBLISHABLE_KEY;
}
test('no public config fails closed and makes no upstream call',async()=>{
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('upstream called')};
 const r=await result(request('list'));
 assert.equal(r.status,503);assert.equal(r.data.live,false);assert.equal(calls,0);
});
test('public listing reads only the allowlisted view',async()=>{
 setup();let upstream;
 globalThis.fetch=async(url,options)=>{
   upstream={url,options};
   return new Response(JSON.stringify([{id:'lot-1',status:'open',start_cents:500}]),{status:200,headers:{'content-type':'application/json'}});
 };
 const r=await result(request('list'));assert.equal(r.status,200);
 assert.equal(r.data.live,true);assert.equal(r.data.auctions.length,1);
 assert.match(upstream.url,/mtg_auction_lots_v2\?select=/);
 assert.ok(!upstream.options.headers.authorization);
 assert.equal(upstream.options.headers.apikey,apiKey);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('buyer bids require bearer authentication before RPC',async()=>{
 setup();let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}')};
 let r=await result(request('bid',{method:'POST',body:{}}));
 assert.equal(r.status,401);assert.equal(calls,0);
 r=await result(request('checkout',{method:'POST',body:{order_id:'abcd'}}));
 assert.equal(r.status,401);assert.equal(calls,0);
});
test('extra bidder_id cannot forge a buyer',async()=>{
 setup();let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}')};
 const r=await result(request('bid',{method:'POST',headers:{authorization:'Bearer demo'},
 body:{p_auction:'11111111-1111-4111-8111-111111111111',
 p_amount_cents:200,p_request_id:'22222222-2222-4222-8222-222222222222',p_bidder_id:'victim'}}));
 assert.equal(r.status,422);assert.equal(calls,0);
});
test('bid calls preserve JWT, validated cents and request ID',async()=>{
 setup();let upstream;
 globalThis.fetch=async(url,options)=>{upstream={url,options};return new Response(JSON.stringify({bid_id:'bid-verified',accepted_cents:1200}),{status:200})};
 const payload={p_auction:'11111111-1111-4111-8111-111111111111',p_amount_cents:1200,p_request_id:'22222222-2222-4222-8222-222222222222'};
 const r=await result(request('bid',{method:'POST',headers:{authorization:'Bearer opaque-jwt'},body:payload}));
 assert.equal(r.status,200);assert.equal(r.data.result.accepted_cents,1200);
 assert.match(upstream.url,/\/rest\/v1\/rpc\/mtg_auction_bid_v2$/);
 assert.equal(upstream.options.headers.authorization,'Bearer opaque-jwt');
 assert.deepEqual(JSON.parse(upstream.options.body),payload);
});
test('origin mismatch refuses submission, no provider call',async()=>{
 setup();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('not expected')};
 const r=await result(request('register',{method:'POST',headers:{origin:'https://evil.example'},body:{}}));
 assert.equal(r.status,403);assert.equal(calls,0);
});
test('provider missing schema is unavailable not a pretend success',async()=>{
 setup();globalThis.fetch=async()=>new Response(JSON.stringify({code:'PGRST202'}),{status:404});
 const r=await result(request('list'));assert.equal(r.status,503);assert.equal(r.data.error,'AUCTION_SCHEMA_NOT_DEPLOYED');
});
test('provider outage reports unavailable and never fabricates listings',async()=>{
 setup();globalThis.fetch=async()=>{throw Error('connection refused')};
 const r=await result(request('list'));assert.equal(r.status,503);assert.equal(r.data.live,false);
});
test('upstream auth failures never become accepted bids',async()=>{
 setup();globalThis.fetch=async()=>new Response(JSON.stringify({code:'42501',message:'forbidden'}),{status:403});
 const payload={p_auction:'11111111-1111-4111-8111-111111111111',p_amount_cents:200,p_request_id:'22222222-2222-4222-8222-222222222222'};
 const r=await result(request('bid',{method:'POST',headers:{authorization:'Bearer opaque'},body:payload}));
 assert.equal(r.status,403);assert.equal(r.data.error,'AUCTION_OPERATION_REJECTED');
});
process.on('exit',()=>{globalThis.fetch=originalFetch;process.env.SUPABASE_URL=saved.url;process.env.SUPABASE_ANON_KEY=saved.key});
