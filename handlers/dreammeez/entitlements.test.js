'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sign}=require('../../BEC-PRIME/compiled/website/lib/signedSession');
const {createHandler,QUERY}=require('./entitlements.js');
const secret='synthetic-secret-at-least-32-characters-for-unit-tests';
const id='u_0123456789abcdef01234567';
async function run({method='GET',cookie='',envSecret=secret,db='synthetic-neon-url',rows=[],throws=false}={}){
 const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(b){this.body=JSON.parse(b)}};
 const calls=[];
 const handler=createHandler({env:()=>({DREAMLEDGER_SESSION_SECRET:envSecret,NEON_DATABASE_URL:db}),
  run:async(conn,query,params)=>{calls.push({conn,query,params});if(throws)throw Error('database secrets');return rows;}});
 await handler({method,headers:{cookie}},res);
 return {res,calls};
}
function signed(){return 'dreamiez_session='+encodeURIComponent(sign(id,secret));}
test('server-authorized account receives exact projected active entitlements',async()=>{
 const {res,calls}=await run({cookie:signed(),rows:[{item_id:'kelp-hoodie',customer_email:'private@example.invalid'}]});
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body.owned,['kelp-hoodie']);
 assert.deepEqual(calls[0].params,[id]);
 assert.ok(!JSON.stringify(res.body).includes('private@example.invalid'));
 assert.match(QUERY,/grant_status='active'/);
 assert.doesNotMatch(QUERY,/SELECT \*/);
});
test('legacy unsigned id cannot read any entitlement',async()=>{
 const r=await run({cookie:'dreamiez_session='+id});
 assert.equal(r.res.statusCode,401);assert.equal(r.calls.length,0);
});
test('anonymous and arbitrary query user cannot be used as an authority',async()=>{
 const r=await run({cookie:''});
 assert.equal(r.res.statusCode,401);assert.equal(r.calls.length,0);
});
test('not GET, no self-grant endpoint',async()=>{
 const r=await run({method:'POST',cookie:signed()});
 assert.equal(r.res.statusCode,405);assert.equal(r.calls.length,0);
});
test('missing secret or database fails closed',async()=>{
 const a=await run({envSecret:'',cookie:signed()});
 const b=await run({db:'',cookie:signed()});
 assert.equal(a.res.statusCode,503);assert.equal(b.res.statusCode,503);
});
test('database error never becomes positive empty ownership',async()=>{
 const r=await run({cookie:signed(),throws:true});
 assert.equal(r.res.statusCode,503);
 assert.equal(r.res.body.error,'OWNERSHIP_SERVICE_UNAVAILABLE');
 assert.ok(!JSON.stringify(r.res.body).includes('database secrets'));
});
test('private cache is forbidden',async()=>{
 const r=await run({cookie:signed()});
 assert.match(r.res.headers['cache-control'],/no-store/);
});
