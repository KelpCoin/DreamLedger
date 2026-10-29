'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'avatar-identity.js'),'utf8');
function harness({saved={},server=[]}={}) {
 let store={dreamledger_avatar_identity_v1:JSON.stringify(saved)};
 const events=[];
 const window={
   localStorage:{
     getItem:k=>store[k]||null,
     setItem:(k,v)=>{store[k]=String(v)}
   },
   fetch:async()=>({ok:true,json:async()=>({verified_source:'server',owned:server})}),
   dispatchEvent:x=>events.push(x.type||'unknown'),
   CustomEvent:function(type,arg){this.type=type;this.detail=arg.detail}
 };
 vm.runInNewContext(code,{window,CustomEvent:window.CustomEvent,console});
 return {api:window.DreamLedgerAvatar,store,events};
}
test('edited localStorage cannot create paid ownership or buffs',()=>{
 const h=harness({saved:{owned:['chrome-boots','kelp-hoodie'],
  equipped:{feet:'chrome-boots',body:'kelp-hoodie'},display_name:'Editor'}});
 assert.deepEqual(Array.from(h.api.load().owned),[]);
 assert.equal(h.api.load().equipped.feet,null);
 assert.deepEqual(Array.from(h.api.toPhinhavenLoadout().active_buffs),[]);
 assert.equal(h.api.toPhinhavenLoadout().gameplay_authoritative,false);
});
test('local own() is no-op and cannot unlock paid item',()=>{
 const h=harness();
 h.api.own('neon-shades');
 assert.deepEqual(Array.from(h.api.load().owned),[]);
 assert.equal(h.api.equip('neon-shades').equipped.face,null);
});
test('signed server list hydrates browser-only visual state',async()=>{
 const h=harness({server:['neon-shades','nonexistent']});
 await h.api.refreshEntitlements();
 assert.deepEqual(Array.from(h.api.load().owned),['neon-shades']);
 assert.equal(h.api.equip('neon-shades').equipped.face,'neon-shades');
 assert.deepEqual(JSON.parse(h.store.dreamledger_avatar_identity_v1).owned,[]);
 assert.equal(h.api.toPhinhavenLoadout().cosmetics.length,1);
 assert.deepEqual(Array.from(h.api.toPhinhavenLoadout().active_buffs),[]);
});
test('avatar adapter refuses absent or incompatible section',()=>{
 const h=harness();
 assert.equal(h.api.toAvatarEquip({item_id:'x'}),null);
 assert.equal(h.api.toAvatarEquip({item_id:'x',consuming_systems:{avatar:{compatible:false,cosmetic_slot:'body'}}}),null);
 const mapped=h.api.toAvatarEquip({item_id:'scarf',name:'Scarf',consuming_systems:{avatar:{compatible:true,cosmetic_slot:'neck',display_priority:5},rpg:{compatible:true,damage:999}}});
 assert.equal(mapped.slot,'neck');
 assert.ok(!Object.hasOwn(mapped,'rpg'));
 assert.ok(!Object.hasOwn(mapped,'damage'));
});
test('studio has no local demo grant or unrelated payment CTA',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','avatar.html'),'utf8');
 assert.doesNotMatch(html,/Unlock demo/);
 assert.doesNotMatch(html,/Pay NZ\$3\.99/);
 assert.doesNotMatch(html,/DreamLedgerAvatar\.own\(/);
 assert.match(html,/refreshEntitlements\(/);
});
