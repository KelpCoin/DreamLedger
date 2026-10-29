'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler,QUERY}=require('./silos.js');
const fixture={silo_id:'baby-kids',display_name:'Baby and Kids',currency:'NZD',locale:'en-NZ',inventory_mode:'physical',payment_provider:'external',peer_fee_basis_points:0,internal_metadata:'not public'};
function mock({rows=[fixture],configured=true,method='GET'}={}) {
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(data){this.body=JSON.parse(data)}};
 return createHandler({env:()=>configured?'test-connection':'',query:()=>async()=>rows})({method},res).then(()=>res);
}
test('registered silo is derived from approved public policy fields',async()=>{
 const res=await mock();
 assert.equal(res.statusCode,200);
 assert.equal(res.body.schema,'CUBE/SILO-REGISTRY/v2');
 assert.equal(res.body.silos[0].route,'/baby-kids/');
 assert.equal(res.body.silos[0].peer_fee_basis_points,0);
 assert.ok(!JSON.stringify(res.body).includes('internal_metadata'));
});
test('registry has no hard-coded domains',()=>{
 assert.match(QUERY,/marketplace.silo_contracts/);
 assert.match(QUERY,/legal_review_approved_at/);
 assert.doesNotMatch(QUERY,/silo_id = 'mtg'/);
});
test('empty registry cannot invent live silos',async()=>{
 const res=await mock({rows:[]});
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body.silos,[]);
});
test('unavailable registry fails closed',async()=>{
 const res=await mock({configured:false});
 assert.equal(res.statusCode,503);
});
test('non-GET cannot mutate registry',async()=>{
 const res=await mock({method:'POST'});
 assert.equal(res.statusCode,405);
});
