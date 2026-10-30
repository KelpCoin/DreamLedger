'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler,validateTerms,QUERIES}=require('./mtg-trades');
const A='u_'+'a'.repeat(24),B='u_'+'b'.repeat(24),C='u_'+'c'.repeat(24);
const H='f'.repeat(64),ID='123e4567-e89b-42d3-a456-426614174000';
const KEY='abcdef0123456789';
const sampleCard={name:'Sol Ring',set:'CMM',collector_number:'395',finish:'nonfoil',
 condition:'NM',quantity:1,photo_sha256:[]};
const terms={party_a_gives:[sampleCard],party_b_gives:[{...sampleCard,name:'Arcane Signet'}],
 handoff:'tracked_shipping',cash_minor:0,notes:'Sleeved and tracked'};
const cfg={MTG_TRADE_LEDGER_ENABLED:'true',NEON_DATABASE_URL:'mock',
 DREAMLEDGER_SESSION_SECRET:'x'.repeat(40),DREAMLEDGER_PUBLIC_ORIGIN:'https://dreamledger.org'};
function mock(method,body,who=A,override={},result={trade_id:ID,state:'proposed',terms_sha256:H}){
 const calls=[];const h=createHandler({env:()=>({...cfg,...override}),
  identity:()=>who,db:()=>async (sql,args)=>{calls.push({sql,args});return [{receipt:result}]}});
 const req={method,url:method==='GET'?'/api/cube/mtg-trades?trade_id='+ID:'/api/cube/mtg-trades',
  body,headers:{origin:'https://dreamledger.org','content-type':'application/json'}};
 const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},
  end(x){this.body=JSON.parse(x)}};
 return h(req,res).then(()=>({res,calls}));
}
test('canonical terms record printing condition quantity and zero MTG platform fee',()=>{
 const t=validateTerms(terms);
 assert.equal(t.platform_fee_minor,0);
 assert.equal(t.party_a_gives[0].condition,'NM');
 assert.equal(t.party_b_gives[0].set,'CMM');
 assert.equal(t.currency,'NZD');
});
test('rejects ambiguous or forged card information',()=>{
 for(const bad of [
  {...terms,party_a_gives:[{...sampleCard,quantity:0}]},
  {...terms,party_a_gives:[{...sampleCard,condition:'unknown'}]},
  {...terms,party_a_gives:[{...sampleCard,name:'Sol Ring',unseen:'x'}]},
  {...terms,party_a_gives:[]},
  {...terms,cash_minor:1.5},
  {...terms,handoff:'undefined'}])
  assert.throws(()=>validateTerms(bad));
});
test('rejects unsigned user',async()=>{
 const {res,calls}=await mock('POST',{action:'propose',party_b:B,idempotency_key:KEY,terms},null);
 assert.equal(res.statusCode,401);assert.equal(calls.length,0);
});
test('no enabled store returns 503 and does not make false ledger',async()=>{
 const {res,calls}=await mock('POST',{action:'propose',party_b:B,idempotency_key:KEY,terms},A,{MTG_TRADE_LEDGER_ENABLED:'false'});
 assert.equal(res.statusCode,503);assert.equal(calls.length,0);
});
test('proposal derives the party a from signed cookie, not JSON',async()=>{
 const {res,calls}=await mock('POST',{action:'propose',party_b:B,idempotency_key:KEY,terms});
 assert.equal(res.statusCode,201);assert.equal(calls.length,1);
 assert.equal(calls[0].sql,QUERIES.propose);
 assert.equal(calls[0].args[0],A);
 assert.equal(calls[0].args[1],B);
 assert.equal(JSON.parse(calls[0].args[2]).platform_fee_minor,0);
});
test('cannot create an offer to yourself',async()=>{
 const {res,calls}=await mock('POST',{action:'propose',party_b:A,idempotency_key:KEY,terms});
 assert.equal(res.statusCode,400);assert.equal(calls.length,0);
});
test('both acceptances must explicitly acknowledge the precise hash',async()=>{
 const b={action:'accept',trade_id:ID,terms_sha256:H,idempotency_key:KEY};
 const x=await mock('POST',b,B);assert.equal(x.res.statusCode,400);assert.equal(x.calls.length,0);
 const y=await mock('POST',{...b,acknowledge_exact_terms:true},B);
 assert.equal(y.res.statusCode,200);
 assert.deepEqual(y.calls[0].args,[B,ID,'accept',H,KEY]);
});
test('dispute remains a legal option after assent',async()=>{
 const {res,calls}=await mock('POST',{action:'dispute',trade_id:ID,terms_sha256:H,idempotency_key:KEY},A);
 assert.equal(res.statusCode,200);assert.equal(calls[0].args[2],'dispute');
});
test('cannot view a private receipt without identity',async()=>{
 const x=await mock('GET',{},null);assert.equal(x.res.statusCode,401);
 const y=await mock('GET',{},C);assert.equal(y.calls[0].sql,QUERIES.receipt);
 assert.equal(y.calls[0].args[0],C); // DB must reject non-participant: see SQL.
});
test('rejects unauthorized mutation or extra fields',async()=>{
 const x=await mock('POST',{action:'propose',party_a:C,party_b:B,idempotency_key:KEY,terms});
 assert.equal(x.res.statusCode,400);assert.equal(x.calls.length,0);
});
test('returns no evidence if database is unavailable',async()=>{
 const {res}=await mock('POST',{action:'propose',party_b:B,idempotency_key:KEY,terms},A,{},null);
 assert.equal(res.statusCode,503);
});
test('does not present the hash as payment or fulfilment evidence',()=>{
 const t=validateTerms(terms);
 assert.equal('payment_verified' in t,false);
 assert.equal('fulfilment_verified' in t,false);
});


test('dispatch requires an evidence hash and preserves signed identity',async()=>{
 const no=await mock('POST',{action:'dispatch',trade_id:ID,terms_sha256:H,idempotency_key:KEY},B);
 assert.equal(no.res.statusCode,400);assert.equal(no.calls.length,0);
 const yes=await mock('POST',{action:'dispatch',trade_id:ID,terms_sha256:H,idempotency_key:KEY,evidence_sha256:H},B);
 assert.equal(yes.res.statusCode,200);
 assert.equal(yes.calls[0].sql,QUERIES.transition);
 assert.deepEqual(yes.calls[0].args,[B,ID,'dispatch',H,KEY,H]);
});
test('only explicit opt-in publication routes to ledger',async()=>{
 const no=await mock('POST',{action:'publish',trade_id:ID,terms_sha256:H,idempotency_key:KEY},A);
 assert.equal(no.res.statusCode,400);assert.equal(no.calls.length,0);
 const yes=await mock('POST',{action:'publish',trade_id:ID,terms_sha256:H,idempotency_key:KEY,acknowledge_publication:true},A);
 assert.equal(yes.res.statusCode,200);
 assert.deepEqual(yes.calls[0].args,[A,ID,'publish',H,KEY,null]);
 const undo=await mock('POST',{action:'unpublish',trade_id:ID,terms_sha256:H,idempotency_key:KEY},A);
 assert.equal(undo.res.statusCode,200);
 assert.deepEqual(undo.calls[0].args,[A,ID,'unpublish',H,KEY,null]);
});
test('dispute can be logged through the post-agreement transition',async()=>{
 const yes=await mock('POST',{action:'dispute',trade_id:ID,terms_sha256:H,idempotency_key:KEY},A);
 assert.equal(yes.calls[0].sql,QUERIES.transition);
 assert.deepEqual(yes.calls[0].args,[A,ID,'dispute',H,KEY,null]);
});
