'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, QUERY } = require('./marketplace.js');
const row = {
 id:'00000000-0000-4000-8000-000000000001',silo_id:'mtg',sku:'TEST',
 slug:'test',title:'Test',description:'Example',category:'collectible',
 listing_type:'product',price_minor:'2500',currency:'nzd',quantity:1,
 private_address:'never public',contact_email:'private@example.invalid'
};
async function request({url='/api/cube/marketplace',method='GET',rows=[row],configured='dummy',throws=false}={}){
 const res={statusCode:null,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=JSON.parse(body)}};
 const calls=[];
 await createHandler({getEnv:()=>configured,getQuery:()=>async(q,params)=>{
   calls.push({q,params});
   if(throws)throw Error('secret database detail');
   return rows;
 }})({url,method},res);
 return {res,calls};
}
test('public projection strips all private data',async()=>{
 const {res}=await request();
 assert.equal(res.statusCode,200);assert.equal(res.body.items[0].price_minor,2500);
 assert.equal(res.body.items[0].status,'published');
 assert.ok(!JSON.stringify(res.body).includes('private@example.invalid'));
 assert.ok(!JSON.stringify(res.body).includes('private_address'));
 assert.equal(res.body.independent_revenue_evidence,false);
});
test('SQL status/stock/physical evidence gates and no wildcard select',()=>{
 assert.match(QUERY,/status = 'published'/);assert.match(QUERY,/quantity > 0/);
 assert.match(QUERY,/physical_verification_receipt_sha256/);
 assert.doesNotMatch(QUERY,/SELECT \*/);
});
test('query uses parameters and rejects malicious silo',async()=>{
 const a=await request({url:'/api/cube/marketplace?silo=mtg&limit=2&offset=3'});
 assert.deepEqual(a.calls[0].params,['mtg',2,3]);
 const b=await request({url:'/api/cube/marketplace?silo=mtg%27%3BDROP'});
 assert.equal(b.res.statusCode,400);assert.equal(b.calls.length,0);
});
test('unknown query keys rejected',async()=>{
 assert.equal((await request({url:'/api/cube/marketplace?private=1'})).res.statusCode,400);
});
test('non-GET cannot mutate',async()=>{
 const a=await request({method:'POST'});assert.equal(a.res.statusCode,405);
 assert.equal(a.calls.length,0);
});
test('missing Neon env fails closed',async()=>{
 const a=await request({configured:''});
 assert.equal(a.res.statusCode,503);assert.equal(a.res.body.error,'NEON_DATABASE_NOT_CONFIGURED');
});
test('query failure gives generic error without secrets',async()=>{
 const a=await request({throws:true});
 assert.equal(a.res.statusCode,503);assert.equal(a.res.body.error,'MARKETPLACE_DATA_UNAVAILABLE');
 assert.ok(!JSON.stringify(a.res.body).includes('secret'));
});
test('empty feed never claims revenue',async()=>{
 const a=await request({rows:[]});
 assert.equal(a.res.statusCode,200);assert.equal(a.res.body.count,0);
 assert.equal(a.res.body.independent_revenue_evidence,false);
});
test('bad or overly large pagination rejected',async()=>{
 for(const p of ['limit=101','limit=-1','limit=0','limit=01','offset=5001','offset=1e9']){
   const a=await request({url:'/api/cube/marketplace?'+p});
   assert.equal(a.res.statusCode,400,p);
 }
});
test('unsafe numeric amount not exposed',async()=>{
 const a=await request({rows:[{...row,price_minor:'999999999999999999999999'}]});
 assert.equal(a.res.statusCode,503);
});
test('safe response headers',async()=>{
 const a=await request();
 assert.equal(a.res.headers['x-content-type-options'],'nosniff');
 assert.match(a.res.headers['cache-control'],/s-maxage=/);
});
