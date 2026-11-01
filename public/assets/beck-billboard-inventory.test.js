'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifiedSnapshot,renderInventory}=require('./beck-billboard-inventory');
const base={schema:'BECK/verified-ad-inventory/v1',inventory_source:'verified_registered_supabase',
 market:'NZ',canvas:{width:1000,height:1000},total_founding_units:100,
 remaining_founding_units:99,unavailable_positions:[{x:0,y:0,width:100,height:100}]};
test('verified geometry maps top-left to first cell',()=>{
 const x=verifiedSnapshot(base);assert.deepEqual(x.occupied,[0]);assert.equal(x.remaining,99);
});
test('wide occupied ad reduces exact cell count',()=>{
 const x=verifiedSnapshot({...base,remaining_founding_units:98,unavailable_positions:[{x:0,y:0,width:200,height:100}]});
 assert.deepEqual(x.occupied,[0,1]);
});
test('irregular geometry consumes intersecting cells',()=>{
 const x=verifiedSnapshot({...base,remaining_founding_units:96,unavailable_positions:[{x:50,y:50,width:100,height:100}]});
 assert.deepEqual(x.occupied,[0,1,10,11]);
});
test('false claimed scarcity count rejected',()=>assert.throws(()=>verifiedSnapshot({...base,remaining_founding_units:33}),/mismatch/));
test('overlapping placement rows rejected',()=>assert.throws(()=>verifiedSnapshot({...base,unavailable_positions:[base.unavailable_positions[0],base.unavailable_positions[0]]}),/overlaps/));
test('unverified provider schema never treated as inventory',()=>assert.throws(()=>verifiedSnapshot({...base,inventory_source:'static_demo'}),/unverified/));
test('invalid bounds are rejected',()=>assert.throws(()=>verifiedSnapshot({...base,unavailable_positions:[{x:990,y:900,width:20,height:100}]}),/geometry/));
test('rendered truthful status does not enable checkout',async()=>{
 const status={textContent:''},doc={getElementById:id=>id==='inventoryproof'?status:null};
 const root={Event:class{constructor(x){this.type=x}},events:[],dispatchEvent(x){this.events.push(x.type)}};
 const r=await renderInventory({doc,rootObject:root,fetchImpl:async()=>({ok:true,json:async()=>base})});
 assert.equal(r.verified,true);assert.equal(r.remaining,99);
 assert.match(status.textContent,/Checkout remains paused/);
 assert.deepEqual(Array.from(root.BECKBoardInventory.blocked),[0]);
 assert.deepEqual(root.events,['beck-ad-inventory-updated']);
});
test('backend unavailable never claims empty canvas',async()=>{
 const status={textContent:''},doc={getElementById:()=>status};
 const root={Event:class{constructor(x){this.type=x}},dispatchEvent(){}};
 const r=await renderInventory({doc,rootObject:root,fetchImpl:async()=>({ok:false,status:503})});
 assert.equal(r.verified,false);
 assert.match(status.textContent,/Live capacity unverified/);
 assert.equal(root.BECKBoardInventory.verified,false);
});
test('browser never trusts count mismatch',async()=>{
 const status={textContent:''},doc={getElementById:()=>status};
 const root={Event:class{},dispatchEvent(){}};
 const r=await renderInventory({doc,rootObject:root,fetchImpl:async()=>({ok:true,json:async()=>({...base,remaining_founding_units:100})})});
 assert.equal(r.verified,false);assert.equal(root.BECKBoardInventory.verified,false);
});
