'use strict';
// BECK-wide candidate. No IO, charges, reservations, or publication.
const crypto=require('node:crypto');
const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const METHODS=Object.freeze(['stripe','bank_transfer','paypal','usdc']);
function compile(placements){
 if(!Array.isArray(placements))throw Error('placements_required');
 const ids=new Set(), result=[];
 for(const p of placements){
  if(!p||typeof p.id!=='string'||ids.has(p.id)||!/^[a-z0-9_-]{2,80}$/i.test(p.id))throw Error('invalid_or_duplicate_id');
  ids.add(p.id);
  if(!p.exhaust||!p.silo||!p.canvas_id)throw Error('namespace_required');
  for(const v of ['x','y','width','height','canvas_width','canvas_height'])if(!Number.isInteger(p[v]))throw Error('geometry_invalid');
  if(p.x<0||p.y<0||p.width<=0||p.height<=0||p.x+p.width>p.canvas_width||p.y+p.height>p.canvas_height)throw Error('out_of_bounds');
  if(!Number.isSafeInteger(p.price_minor)||p.price_minor<=0||!['NZD','USD'].includes(p.currency))throw Error('pricing_invalid');
  if(!['DRAFT','APPROVED','RESERVED','PAID','DELIVERED'].includes(p.status))throw Error('status_invalid');
  const start=Date.parse(p.start_utc),end=Date.parse(p.end_utc);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw Error('window_invalid');
  for(const q of result){
   if(q.exhaust!==p.exhaust||q.silo!==p.silo||q.canvas_id!==p.canvas_id||p.status==='DRAFT'||q.status==='DRAFT')continue;
   const time=start<Date.parse(q.end_utc)&&Date.parse(q.start_utc)<end;
   const area=p.x<q.x+q.width&&q.x<p.x+p.width&&p.y<q.y+q.height&&q.y<p.y+p.height;
   if(time&&area)throw Error('inventory_overlap');
  }
  result.push({...p});
 }
 result.sort((a,b)=>a.id.localeCompare(b.id));
 return {schema:'BECK/ad-inventory/v1',status:'CANDIDATE_NOT_PUBLISHED',count:result.length,inventory_sha256:sha256(result),placements:result};
}
function reconcile(order,e={}){
 if(!order||!METHODS.includes(order.method)||!order.order_id||!order.placement_id||!Number.isSafeInteger(order.amount_minor)||order.amount_minor<=0||!order.currency)throw Error('order_invalid');
 const settled=e.provider_verified===true&&e.final_settlement===true&&e.order_id===order.order_id&&e.amount_minor===order.amount_minor&&e.currency===order.currency&&typeof e.provider_transaction_id==='string'&&e.provider_transaction_id.length>3&&(order.method!=='usdc'||(e.chain_confirmed===true&&e.asset==='USDC'&&!!e.network));
 const delivered=settled&&e.creative_approved===true&&e.delivery_verified===true&&typeof e.delivery_proof_sha256==='string'&&/^[a-f0-9]{64}$/i.test(e.delivery_proof_sha256);
 return {order_id:order.order_id,method:order.method,settlement:settled?'VERIFIED':'UNVERIFIED',delivery:delivered?'VERIFIED':'UNVERIFIED',economic_event:delivered?'ELIGIBLE_FOR_INDEPENDENT_RECONCILIATION':'NOT_VERIFIED',public_activation:'APPROVAL_REQUIRED'};
}
module.exports={compile,reconcile,METHODS};
