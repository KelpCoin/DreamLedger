import {test} from 'node:test';
import assert from 'node:assert/strict';
import router,{createKingdomAuctionRouter} from '../handlers/kingdom-auction.ts';
const root='https://dreamledger.org/api/kingdom-auction';
function req(q=''){return new Request(root+q)}
test('unknown, omitted and wrong-case silos return 404 without touching backend',async()=>{
 for(const q of ['','?silo=amplissa','?silo=adult','?silo=MTG-master','?silo=prototype']){
  const r=await router(req(q));assert.equal(r.status,404);
  assert.equal((await r.json()).error,'KINGDOM_AUCTION_SILO_NOT_REGISTERED');
 }
});
test('approved consumer is routed into its own backend, never a generic unscoped store',async()=>{
 const vars=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY'];
 const prior=vars.map(k=>process.env[k]);
 for(const k of vars)delete process.env[k];
 try{
  const r=await router(req('?silo=mtg-master&action=list'));
  assert.equal(r.status,503);
  const v=await r.json();assert.equal(v.error,'AUCTION_BACKEND_NOT_CONFIGURED');
  assert.equal(v.live,false);
 }finally{vars.forEach((k,i)=>{if(prior[i]===undefined)delete process.env[k];else process.env[k]=prior[i]})}
});

test('One MTG master router supports independently injected unrelated B2B adapters',async()=>{
 const calls=[];
 const b2bA=async req=>{calls.push('equipment');return new Response(JSON.stringify({silo:'industrial-surplus',bidder:'private-A'}),{status:200})};
 const b2bB=async req=>{calls.push('creative');return new Response(JSON.stringify({silo:'creative-services',bidder:'private-B'}),{status:200})};
 const generic=createKingdomAuctionRouter({
  'industrial-surplus':b2bA,'creative-services':b2bB
 });
 let a=await generic(req('?silo=industrial-surplus&action=list'));
 assert.equal(a.status,200);
 assert.equal((await a.json()).silo,'industrial-surplus');
 let b=await generic(req('?silo=creative-services&action=list'));
 assert.equal(b.status,200);
 assert.equal((await b.json()).silo,'creative-services');
 let unknown=await generic(req('?silo=mtg-master&action=list'));
 assert.equal(unknown.status,404);
 assert.deepEqual(calls,['equipment','creative']);
});
test('Cannot smuggle ambiguous or unregistered silo IDs into Kingdom auction router',async()=>{
 const generic=createKingdomAuctionRouter({'industrial-surplus':async()=>new Response('ok')});
 for(const q of ['?silo=industrial-surplus&silo=mtg-master','?silo=__proto__','?silo=industrial-Surplus','?silo=']){
  const r=await generic(req(q));assert.equal(r.status,404);
 }
 assert.throws(()=>createKingdomAuctionRouter({}),/KINGDOM_EMPTY_ADAPTER_REGISTRY/);
});
