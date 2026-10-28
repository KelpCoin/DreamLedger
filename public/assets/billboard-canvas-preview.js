/* Interactive BILLBOARD DEMO ONLY. Pure logic: no checkout, no allocation, no telemetry. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DreamLedgerBillboardPreview=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var CELLS=100;
  function validIndex(i){return Number.isInteger(i)&&i>=0&&i<CELLS;}
  function publishedPositions(items){
    if(!Array.isArray(items))throw Error('INVALID_PUBLISHED_FEED');
    var slots=new Set();
    for(var i=0;i<items.length;i++){
      var p=items[i];
      if(!p||p.status!=='PUBLISHED')throw Error('UNVERIFIED_PUBLIC_PLACEMENT');
      if(p.cell_index===null||p.cell_index===undefined)continue;
      if(!validIndex(p.cell_index))throw Error('INVALID_PUBLISHED_POSITION');
      if(slots.has(p.cell_index))throw Error('DUPLICATE_PUBLISHED_POSITION');
      slots.add(p.cell_index);
    }
    return slots;
  }
  function choosePreview(index,occupied){
    if(!validIndex(index))throw Error('INVALID_DEMO_CELL');
    if(!(occupied instanceof Set))throw Error('PUBLISHED_POSITIONS_REQUIRED');
    if(occupied.has(index))return null;
    return index;
  }
  function firstUnpublished(occupied){
    if(!(occupied instanceof Set))throw Error('PUBLISHED_POSITIONS_REQUIRED');
    for(var i=0;i<CELLS;i++)if(!occupied.has(i))return i;
    return null;
  }
  function label(text){return String(text||'').trim().slice(0,80)||'YOUR IDEA HERE';}
  function coordinates(index){
    if(!validIndex(index))throw Error('INVALID_DEMO_CELL');
    return {col:index%10,row:Math.floor(index/10),x:(index%10)*100,y:Math.floor(index/10)*100,width:100,height:100};
  }
  return Object.freeze({CELLS:CELLS,validIndex:validIndex,publishedPositions:publishedPositions,
    choosePreview:choosePreview,firstUnpublished:firstUnpublished,label:label,coordinates:coordinates});
});
