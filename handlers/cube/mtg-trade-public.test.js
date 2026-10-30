'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {createHandler,QUERY}=require('./mtg-trade-public');
const ID='123e4567-e89b-42d3-a456-426614174000';
const HASH='a'.repeat(64);
function fixture(){
 return {schema:'dreamledger/mtg-trade-public-receipt/v1',
 silo:'dreamledger-mtg',trade_id:ID,both_agreed:true,status:'completed',
 terms_sha256:HASH,latest_event_sha256:HASH,event_count:9,
 party_a_gives:[{name:'Sol Ring',set:'CMM',collector_number:'395',condition:'NM',finish:'nonfoil',quantity:1,private_note:'DO_NOT_LEAK'}],party_b_gives:[],party_a_label:'Trader A',party_b_label:'Trader B',
 private_shipping_address:'SHOULD_NOT_LEAK',party_a:'u_'+'f'.repeat(24),
 notes:'SHOULD_NOT_LEAK'};
}
async function call(reply,env={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}};
 let queried=false,sql;
 const f=createHandler({env:()=>({NEON_DATABASE_URL:'mock',MTG_TRADE_LEDGER_ENABLED:'true',...env}),
 db:()=>async(statement,args)=>{queried=true;sql=statement;assert.equal(args[0],ID);return [{receipt:reply}]}});
 await f({method:'GET',url:'/api/cube/mtg-trade-public?trade_id='+ID},res);
 return {res,queried,sql};
}
test('public receipt requires explicit dual consent in SQL projection',async()=>{
 const r=await call(null);assert.equal(r.res.statusCode,404);
 assert.equal(r.sql,QUERY);
 assert.match(r.sql,/mtg_trade_public_receipt/);
});
test('never reveals extra private DB fields even when present',async()=>{
 const r=await call(fixture());assert.equal(r.res.statusCode,200);
 assert.equal(r.res.headers['cache-control'],'no-store');
 assert.equal(r.res.body.private_shipping_address,undefined);
 assert.equal(r.res.body.party_a,undefined);
 assert.equal(r.res.body.notes,undefined);
 assert.equal(r.res.body.party_a_gives[0].private_note,undefined);
 assert.equal(r.res.body.terms_sha256,HASH);
});
test('refuse false dual consent',async()=>{
 const r=await call({...fixture(),both_agreed:false});
 assert.equal(r.res.statusCode,503);
});
test('fails closed without a released database',async()=>{
 const r=await call(fixture(),{MTG_TRADE_LEDGER_ENABLED:'false'});
 assert.equal(r.res.statusCode,503);assert.equal(r.queried,false);
});
test('rejects invalid, uncontrolled and duplicate URL parameters',async()=>{
 for(const url of ['/api/cube/mtg-trade-public?trade_id=bad',
  '/api/cube/mtg-trade-public?trade_id='+ID+'&secret=x']){
  const res={setHeader(){},end(s){this.body=JSON.parse(s)}};
  await createHandler({env:()=>({MTG_TRADE_LEDGER_ENABLED:'true',NEON_DATABASE_URL:'mock'})})({method:'GET',url},res);
  assert.equal(res.statusCode,400);
 }
});
