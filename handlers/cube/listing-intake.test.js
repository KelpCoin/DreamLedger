'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const signedSession=require('../../BEC-PRIME/compiled/website/lib/signedSession');
const {createHandler,parse,QUERY}=require('./listing-intake.js');
const secret='synthetic-session-secret-long-enough-for-tests-2026';
const user='u_0123456789abcdef01234567';
const cookie='dreamiez_session='+encodeURIComponent(signedSession.sign(user,secret));
const body={silo:'baby-kids',idempotency_key:'candidate-req-0123456',
 listing_kind:'physical',title:'Warm baby cardigan',
 description:'Second-hand example, photos and condition need review',
 price_minor:1200,currency:'NZD',quantity:1,fulfillment_mode:'shipping',
 attributes:{size:'2T',age_range:'18-24 months'},photo_urls:[]};
async function invoke({method='POST',payload=body,auth=cookie,config=true,returns=[
 {id:'00000000-0000-4000-8000-000000000004',status:'pending'}],throws=false}={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(x){this.body=JSON.parse(x)}};
 const calls=[];
 const handler=createHandler({env:()=>({NEON_DATABASE_URL:config?'synthetic-url':'',
  DREAMLEDGER_SESSION_SECRET:config?secret:''}),
  db:()=>async(sql,args)=>{calls.push({sql,args});if(throws)throw Error('synthetic DB exception');return returns;}});
 await handler({method,headers:{'content-type':'application/json',cookie:auth},body:payload},res);
 return {res,calls};
}
test('independent seller can submit a domain-neutral draft, never a public listing',async()=>{
 const x=await invoke();
 assert.equal(x.res.statusCode,202);
 assert.equal(x.res.body.silo,'baby-kids');
 assert.equal(x.res.body.available_for_sale,false);
 assert.equal(x.res.body.publication_authorized,false);
 assert.equal(x.res.body.status,'pending');
 assert.equal(x.calls[0].args[1],user);
 assert.equal(x.calls[0].args[7],1200);
});
test('intake SQL only creates private queue entries when silo is approved',()=>{
 assert.match(QUERY,/marketplace.silo_contracts/);
 assert.match(QUERY,/sc.status='active'/);
 assert.match(QUERY,/sc.currency=\$9/);
 assert.match(QUERY,/payload_sha256=\$4/);
 assert.match(QUERY,/ON CONFLICT/);
 assert.doesNotMatch(QUERY,/INSERT INTO marketplace.listings/);
});
test('same idempotency key only replays matching digest',()=>{
 assert.match(QUERY,/q.idempotency_key=\$3/);
 assert.match(QUERY,/q.payload_sha256=\$4/);
 const a=parse(body),b=parse({...body,title:'Different sweater'});
 assert.notEqual(a.digest,b.digest);
 assert.equal(a.digest,parse(body).digest);
});
test('unsigned session and missing database are denied',async()=>{
 const a=await invoke({auth:'dreamiez_session='+user});
 const b=await invoke({config:false});
 assert.equal(a.res.statusCode,401);
 assert.equal(b.res.statusCode,503);
 assert.equal(a.calls.length,0);
});
test('cannot self-approve, set stock, pass credentials or cross silo via payload',async()=>{
 for(const added of [{status:'published'},{checkout_enabled:true},{customer_email:'person@example.invalid'},
   {silo:'../other'},{price_minor:-1},{photo_urls:['javascript:alert(1)']}]){
  const x=await invoke({payload:{...body,...added}});
  assert.equal(x.res.statusCode,400);
  assert.equal(x.calls.length,0);
 }
});
test('unknown silo, duplicate or rate limited submission stays unaccepted',async()=>{
 const x=await invoke({returns:[]});
 assert.equal(x.res.statusCode,409);
});
test('DB error does not expose internal data',async()=>{
 const x=await invoke({throws:true});
 assert.equal(x.res.statusCode,503);
 assert.ok(!JSON.stringify(x.res.body).includes('synthetic DB'));
});
