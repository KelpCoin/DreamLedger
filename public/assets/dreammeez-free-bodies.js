/* DreamMeez paper-doll baseline v1: FREE bodies, independent of payment identity.
 * This is a geometric CSS-preview rig, NOT human-drawn production artwork.
 * Preserve sketches in a private archive; paid costumes require human visual fit approval.
 */
(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DreamMeezFreeBodies = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  var SCHEMA = 'dreammeez/2d-free-body-rig/v1';
  var CANVAS = 1024;
  var SHAPES = [
    {id:1, label:'Straight', torsoRadius:'33% 33% 23% 23%', torsoFactor:0.94, shoulder:0.34, waist:0.29, hip:0.32, backFactor:0.94},
    {id:2, label:'Balanced', torsoRadius:'42% 42% 20% 20%', torsoFactor:1.0, shoulder:0.37, waist:0.32, hip:0.37, backFactor:1.0},
    {id:3, label:'Broad shoulders', torsoRadius:'32% 32% 28% 28%', torsoFactor:1.08, shoulder:0.46, waist:0.35, hip:0.37, backFactor:1.09},
    {id:4, label:'Curved', torsoRadius:'45% 45% 33% 33%', torsoFactor:1.13, shoulder:0.39, waist:0.39, hip:0.47, backFactor:1.16},
    {id:5, label:'Full figure', torsoRadius:'46% 46% 43% 43%', torsoFactor:1.2, shoulder:0.45, waist:0.47, hip:0.52, backFactor:1.23}
  ];
  // These numerical anchor proposals are guides for future *drawn* fit layers.
  // They are NOT proof that a garment passes clipping or visual fitting.
  var POINT_NAMES = [
    'neck','shoulder_left','shoulder_right','elbow_left','elbow_right',
    'wrist_left','wrist_right','waist_left','waist_right','hip_left','hip_right',
    'knee_left','knee_right','ankle_left','ankle_right',
    'strap_left','strap_right','backpack_top','backpack_bottom'
  ];
  function getShape(id) {
    for(var i=0;i<SHAPES.length;i++)if(SHAPES[i].id===Number(id))return SHAPES[i];
    return SHAPES[1];
  }
  function p(x,y){return {x:Number(x.toFixed(4)),y:Number(y.toFixed(4))};}
  function anchors(id){
    var s=getShape(id);
    return {
      neck:p(.5,.29),
      shoulder_left:p(.5-s.shoulder/2,.325),
      shoulder_right:p(.5+s.shoulder/2,.325),
      elbow_left:p(.5-s.shoulder/2-.045,.47),
      elbow_right:p(.5+s.shoulder/2+.045,.47),
      wrist_left:p(.5-s.shoulder/2-.065,.60),
      wrist_right:p(.5+s.shoulder/2+.065,.60),
      waist_left:p(.5-s.waist/2,.55),
      waist_right:p(.5+s.waist/2,.55),
      hip_left:p(.5-s.hip/2,.665),
      hip_right:p(.5+s.hip/2,.665),
      knee_left:p(.5-s.hip*.23,.79),
      knee_right:p(.5+s.hip*.23,.79),
      ankle_left:p(.5-s.hip*.23,.925),
      ankle_right:p(.5+s.hip*.23,.925),
      strap_left:p(.5-s.shoulder*.34,.345),
      strap_right:p(.5+s.shoulder*.34,.345),
      backpack_top:p(.5,.345),
      backpack_bottom:p(.5,.69)
    };
  }
  function fitPreview(shapeId,buildScale){
    var s=getShape(shapeId);
    var scale=Number(buildScale);
    if(!Number.isFinite(scale)||scale<.4||scale>1.7)scale=1;
    return {
      torsoScaleX:Number((scale*s.torsoFactor).toFixed(3)),
      rearLayerScaleX:Number((scale*s.backFactor).toFixed(3)),
      torsoRadius:s.torsoRadius,
      preview_only:true,
      garment_fit_verified:false,
      paid_entitlement_required:false
    };
  }
  function validate(){
    if(SHAPES.length!==5)throw Error('FIVE_FREE_BASE_SHAPES_REQUIRED');
    var seen={};
    SHAPES.forEach(function(s){
      if(seen[s.id]||s.id<1||s.id>5)throw Error('INVALID_FREE_BODY_ID');
      seen[s.id]=true;
      if('price' in s||'sku' in s||'checkout' in s||'entitlement' in s)throw Error('BODY_MUST_BE_FREE');
      var a=anchors(s.id);
      POINT_NAMES.forEach(function(key){var v=a[key];if(!v||v.x<0||v.x>1||v.y<0||v.y>1)throw Error('OUT_OF_CANVAS_ANCHOR_'+key);});
      if(a.shoulder_left.x>=a.shoulder_right.x||a.hip_left.x>=a.hip_right.x)throw Error('INVALID_ANCHOR_SYMMETRY');
      if(a.neck.y>=a.hip_left.y||a.hip_left.y>=a.knee_left.y)throw Error('INVALID_VERTICAL_ORDER');
    });
    return true;
  }
  validate();
  return Object.freeze({
    schema:SCHEMA, canvas:CANVAS, all_bodies_free:true,
    source_art_status:'AWAITING_ORIGINAL_HAND_DRAWN_SKETCHES',
    no_face_base:true, shapes:SHAPES.map(function(s){return Object.freeze(s);}),
    point_names:POINT_NAMES, getShape:getShape, anchors:anchors,
    fitPreview:fitPreview, validate:validate
  });
});
