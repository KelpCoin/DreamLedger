'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler,QUERY}=require('./community.js');
const post={id:'00000000-0000-4000-8000-000000000001',kind:'discussion',
 title:'Local players',body:'A public, moderated conversation',public_alias:'FriendlyUser',
 published_at:'2026-10-29T00:00:00Z',account_id:'not-a-public-field',email:'private@example.invalid'};
async function call(url,options={}) {
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}};
 let called=false;
 await createHandler({env:()=>options.off?'':'synthetic',query:()=>async(sql,params)=>{
  called=true;
  assert.deepEqual(params,[options.silo||'baby-kids',30]);
  return options.posts||[post];
 }})({url,method:options.method||'GET'},res);
 return {res,called};
}
test('public community records are projected from one silo only',async()=>{
 const x=await call('/api/cube/community?silo=baby-kids');
 assert.equal(x.res.statusCode,200);
 assert.equal(x.res.body.silo,'baby-kids');
 assert.equal(x.res.body.items[0].title,'Local players');
 assert.ok(!JSON.stringify(x.res.body).includes('private@example.invalid'));
 assert.ok(!JSON.stringify(x.res.body).includes('account_id'));
});
test('unapproved and cross-silo content suppressed by parameterized SQL',()=>{
 assert.match(QUERY,/c.silo_id=\$1/);
 assert.match(QUERY,/c.status='published'/);
 assert.match(QUERY,/s.status='active'/);
 assert.match(QUERY,/moderation_receipt_sha256/);
 assert.match(QUERY,/legal_review_approved_at/);
 assert.doesNotMatch(QUERY,/silo_id='mtg'/);
});
test('blank feed has no invented discussions or reputation claims',async()=>{
 const x=await call('/api/cube/community?silo=baby-kids',{posts:[]});
 assert.equal(x.res.body.count,0);
 assert.deepEqual(x.res.body.items,[]);
 assert.equal(x.res.body.activity_estimate_inferred,false);
});
test('missing parameters and non GET reject',async()=>{
 for(const url of ['/api/cube/community','/api/cube/community?silo=mtg&private=yes',
   '/api/cube/community?silo=../bad']){
  const x=await call(url);
  assert.equal(x.res.statusCode,400);
  assert.equal(x.called,false);
 }
 const postReq=await call('/api/cube/community?silo=mtg',{method:'POST'});
 assert.equal(postReq.res.statusCode,405);
});
test('unconfigured service fails closed',async()=>{
 const x=await call('/api/cube/community?silo=mtg',{off:true});
 assert.equal(x.res.statusCode,503);
});
