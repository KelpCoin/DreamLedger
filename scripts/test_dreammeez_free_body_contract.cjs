'use strict';
// Static contract. No network calls, Stripe payments, or fabricated hand-drawn assets.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const rig=require('../public/assets/dreammeez-free-bodies.js');
assert.equal(rig.schema,'dreammeez/2d-free-body-rig/v1');
assert.equal(rig.all_bodies_free,true);
assert.equal(rig.no_face_base,true);
assert.equal(rig.source_art_status,'AWAITING_ORIGINAL_HAND_DRAWN_SKETCHES');
assert.equal(rig.shapes.length,5);
assert.equal(rig.validate(),true);
const canvas=rig.canvas;
assert.equal(canvas,1024);
const geometry=new Set();
for(const shape of rig.shapes){
 const anchors=rig.anchors(shape.id);
 assert.equal(Object.keys(anchors).length,19);
 for(const a of Object.values(anchors)){
  assert(Number.isFinite(a.x)&&Number.isFinite(a.y));
  assert(a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1);
 }
 geometry.add(JSON.stringify(anchors));
 for(let build=0.5;build<=1.60001;build+=.05){
  for(let height=1;height<=9;height++){
   const fit=rig.fitPreview(shape.id,build);
   assert(fit.torsoScaleX>.1&&fit.rearLayerScaleX>.1);
   assert.equal(fit.paid_entitlement_required,false);
   assert.equal(fit.garment_fit_verified,false);
   assert.equal(fit.preview_only,true);
  }
 }
}
assert.equal(geometry.size,5,'All five body silhouettes require distinctive anchors');
const page=read('public/avatar.html');
for(const marker of ['id="shapeChoices"','id="expressionChoices"','DreamMeezFreeBodies.fitPreview',
 'YOUR BODY IS NOT A PRODUCT','All body shapes are free',
 'Original sketch assets and clothing-fit approvals','data-expression']){
 assert(page.includes(marker),'Missing free body studio control: '+marker);
}
assert.equal((page.match(/label:'[^']*',scale:/g)||[]).length,9,'Existing nine free heights must remain available');
assert.equal((page.match(/label:'[^']*',sx:/g)||[]).length,10,'Existing ten free builds must remain available');
assert(page.includes('src="/assets/dreammeez-free-bodies.js"'));
const identity=read('public/assets/avatar-identity.js');
assert(identity.includes('FREE_IDENTITY_FIELDS'));
assert(identity.includes("expression: 'smile'"));
const store=new Map();
const browser={
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 dispatchEvent:()=>{},CustomEvent:function(){},
};
vm.runInNewContext(identity,{window:browser,console});
const api=browser.DreamLedgerAvatar;
for(const key of ['height','build','shape','skin','style','hair','expression'])
 assert.equal(api.isFreeIdentityField(key),true,'Body feature must never be an entitlement: '+key);
const initial=api.load();assert.equal(initial.shape,1);
assert.equal(initial.expression,'smile');
api.save({...initial,shape:5,build:10,height:9,expression:'blank'});
const again=api.load();
assert.equal(again.shape,5);
assert.equal(again.expression,'blank');
const exported=api.exportForSurface('phinhaven');
assert.equal(exported.body.all_body_identity_features_free,true);
assert.equal(exported.entitlements_verified,false);
assert.deepEqual(JSON.parse(JSON.stringify(exported.buffs)),[]);
assert.equal(api.toPhinhavenLoadout().entitlement_verified,false);
const catalog=JSON.parse(read('public/catalog.json'));
for(const item of catalog.products||[]){
 if(!item.checkout_available)continue;
 const id=String(item.id||'').toLowerCase(),category=String(item.category||'').toLowerCase();
 assert(!/(?:avatar-base|body-silhouette|body-type|skin-tone|height-change|build-change|accessibility-body)/.test(id+' '+category),'Paid representation found: '+id);
}
console.log('DREAMMEEZ_FREE_IDENTITY_CONTRACT=PASS; FREE_BASES=5; HEIGHTS=9; BUILDS=10; REAL_SKETCH_ASSETS=0; GARMENT_FIT_CERTIFIED=0');
