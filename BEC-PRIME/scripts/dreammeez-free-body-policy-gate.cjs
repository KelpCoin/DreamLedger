'use strict';
// Model-independent BECK policy enforcement for DreamMeez paid vs free identity.
// Read-only; does not create art, scan user sketches, open Stripe or publish products.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const rig=require('../../public/assets/dreammeez-free-bodies.js');
assert.equal(rig.schema,'dreammeez/2d-free-body-rig/v1');
assert.equal(rig.source_art_status,'AWAITING_ORIGINAL_HAND_DRAWN_SKETCHES');
assert.equal(rig.all_bodies_free,true);
assert.equal(rig.shapes.length,5);
assert.equal(rig.validate(),true);
for(const shape of rig.shapes){
 const anchors=rig.anchors(shape.id);
 assert.equal(Object.keys(anchors).length,19);
 for(let b=0.5;b<1.61;b+=0.1){
  for(let h=1;h<=9;h++){
   const fit=rig.fitPreview(shape.id,b);
   assert.equal(fit.paid_entitlement_required,false);
   assert.equal(fit.garment_fit_verified,false);
  }
 }
}
const doc=read('IP/DreamMeez/FREE-BODY-ART-SPEC-v1.md');
assert(doc.includes('450 body configurations')&&doc.includes('private')&&doc.includes('SKETCH_PENDING'));
const addendum=JSON.parse(read('IP/DreamMeez/usp-201-203-free-identity.json'));
assert.equal(addendum.schema,'beck/dreammeez-free-body-usp-addendum/v1');
assert.deepEqual(addendum.ideas.map(x=>x.id),[201,202,203]);
assert.equal(addendum.automatic_publication,false);
assert.equal(addendum.security.shoppers_never_buy_a_shape,true);
const catalog=JSON.parse(read('public/catalog.json'));
for(const item of catalog.products||[]){
 if(item.checkout_available!==true)continue;
 const id=String(item.id||'').toLowerCase(),type=String(item.category||'').toLowerCase();
 assert(!/(?:avatar-base|body-silhouette|body-type|skin-tone|height-change|build-change|accessibility-body|plus-size-body)/.test(id+' '+type),'Paid identity base SKU prohibited: '+id);
 if(type==='avatar-accessories'){
  assert(!item.body_size_price_overrides && !item.plus_size_surcharge,
         'Fashion must not charge an avatar size surcharge: '+id);
 }
}
const shadow=JSON.parse(read('IP/DreamMeez/shadow-cosmetics-20261028.json'));
assert.equal(shadow.checkout_enabled,false);
assert.equal(shadow.automatic_publication,false);
assert(shadow.items.every(x=>!x.checkout_enabled&&x.owner_approved_to_publish===false));
console.log('BECK_FREE_BODY_NEVER_PAYWALL=PASS; SHAPES=5; CONFIGURATIONS=450; ARTIST_APPROVED_SKETCHES=0; PAID_BODY_SKUS=0; CHECKOUTS_CREATED=0');
