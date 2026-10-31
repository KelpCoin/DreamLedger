import {test} from 'node:test';
import assert from 'node:assert/strict';
import router from '../handlers/kingdom-auction.ts';
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
