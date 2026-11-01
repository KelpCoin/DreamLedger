'use strict';
/* BECK public read-only availability renderer. Never activates checkout. */
(function(root){
  function verifiedSnapshot(d){
    if(!d||d.schema!=='BECK/verified-ad-inventory/v1'||
       d.inventory_source!=='verified_registered_supabase'||d.market!=='NZ'||
       d.canvas?.width!==1000||d.canvas?.height!==1000||
       d.total_founding_units!==100||!Number.isInteger(d.remaining_founding_units)||
       d.remaining_founding_units<0||d.remaining_founding_units>100||
       !Array.isArray(d.unavailable_positions)||d.unavailable_positions.length>=1000){
      throw Error('inventory_unverified');
    }
    const taken=new Set();
    const boxes=[];
    for(const r of d.unavailable_positions){
      if(!r||![r.x,r.y,r.width,r.height].every(Number.isInteger)||
         r.x<0||r.y<0||r.width<=0||r.height<=0||
         r.x+r.width>1000||r.y+r.height>1000)throw Error('inventory_geometry_invalid');
      for(const q of boxes)
        if(r.x<q.x+q.width&&q.x<r.x+r.width&&r.y<q.y+q.height&&q.y<r.y+r.height)
          throw Error('inventory_overlaps');
      boxes.push(r);
      for(let y=0;y<10;y++)for(let x=0;x<10;x++){
        const left=x*100,top=y*100;
        if(left<r.x+r.width&&r.x<left+100&&top<r.y+r.height&&r.y<top+100)taken.add(y*10+x);
      }
    }
    if(d.remaining_founding_units!==100-taken.size)throw Error('inventory_count_mismatch');
    return {remaining:100-taken.size,occupied:Array.from(taken).sort((a,b)=>a-b)};
  }
  async function renderInventory({fetchImpl,doc,rootObject}={}){
    const d=doc||(typeof document!=='undefined'?document:null);
    const w=rootObject||root;
    if(!d||!w)return {verified:false};
    const status=d.getElementById('inventoryproof');
    const fail=()=>{
      w.BECKBoardInventory={verified:false,blocked:new Set()};
      if(status)status.textContent='Live capacity unverified. No position is offered for sale; checkout remains paused.';
      if(typeof w.dispatchEvent==='function'&&typeof w.Event==='function')w.dispatchEvent(new w.Event('beck-ad-inventory-updated'));
      return {verified:false};
    };
    try{
      const fetcher=fetchImpl||(typeof fetch!=='undefined'?fetch:null);
      if(typeof fetcher!=='function')return fail();
      const response=await fetcher('/api/molt-beach-inventory?market=NZ',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response||!response.ok)return fail();
      const snapshot=verifiedSnapshot(await response.json());
      w.BECKBoardInventory={verified:true,blocked:new Set(snapshot.occupied)};
      if(status)status.textContent='Verified inventory: '+snapshot.remaining+' of 100 tile positions are currently unreserved. This is not an offer to purchase. Checkout remains paused.';
      if(typeof w.dispatchEvent==='function'&&typeof w.Event==='function')w.dispatchEvent(new w.Event('beck-ad-inventory-updated'));
      return {verified:true,remaining:snapshot.remaining};
    }catch{return fail();}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={verifiedSnapshot,renderInventory};
  if(root&&typeof root.addEventListener==='function'){
    root.addEventListener('DOMContentLoaded',()=>{renderInventory().catch(()=>{});});
  }
})(typeof window!=='undefined'?window:null);
