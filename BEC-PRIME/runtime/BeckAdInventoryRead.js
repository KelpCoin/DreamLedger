'use strict';
// Read-only, server-only real-scarcity bridge for the NZ billboard. Disabled canvases fail closed.
const {configured}=require('./BeckAdReservationClient');
const {compile}=require('./AdInventoryGate');
const ACTIVE=new Set(['HELD','PAID','APPROVED','PUBLISHED']);
const PAID=new Set(['PAID','APPROVED','PUBLISHED']);
function fetchError(){return Error('beck_ad_inventory_unverified')}
async function inventory({env=process.env,fetchImpl=globalThis.fetch,now=new Date()}={}){
  const {base,key}=configured(env);
  if(typeof fetchImpl!=='function'||!(now instanceof Date)||!Number.isFinite(now.valueOf()))throw fetchError();
  const headers={apikey:key,authorization:'Bearer '+key,accept:'application/json'};
  async function query(table,filters){
    const u=new URL(base+'/rest/v1/'+table);
    for(const [k,v] of Object.entries(filters))u.searchParams.set(k,v);
    let res;
    try{res=await fetchImpl(u.toString(),{headers,signal:AbortSignal.timeout(8000)})}catch{throw fetchError()}
    if(!res?.ok)throw fetchError();
    let rows;try{rows=await res.json()}catch{throw fetchError()}
    if(!Array.isArray(rows)||rows.length>=1000)throw fetchError();
    return rows;
  }
  const canvasRows=await query('beck_ad_canvases',{select:'exhaust,silo,canvas,width,height,booking_enabled',exhaust:'eq.dreamledger',silo:'eq.ads',canvas:'eq.nz_board',limit:'2'});
  if(canvasRows.length!==1||canvasRows[0].booking_enabled!==true||canvasRows[0].width!==1000||canvasRows[0].height!==1000)throw fetchError();
  const at=now.toISOString();
  const rows=await query('beck_ad_reservations',{
    select:'reservation_id,x,y,width,height,status,hold_expires_at,campaign_start,campaign_end',
    exhaust:'eq.dreamledger',silo:'eq.ads',canvas:'eq.nz_board',
    status:'in.(HELD,PAID,APPROVED,PUBLISHED)',
    campaign_start:'lte.'+at,campaign_end:'gt.'+at,limit:'1000'
  });
  const active=rows.filter(r=>ACTIVE.has(r.status)&&(r.status!=='HELD'||Date.parse(r.hold_expires_at)>now.valueOf()));
  const slots=active.map(r=>({id:String(r.reservation_id),exhaust:'dreamledger',silo:'ads',canvas_id:'nz_board',
    x:r.x,y:r.y,width:r.width,height:r.height,canvas_width:1000,canvas_height:1000,
    price_minor:1,currency:'NZD',status:'APPROVED',start_utc:r.campaign_start,end_utc:r.campaign_end}));
  try{compile(slots)}catch{throw fetchError()}
  let remaining=0;
  for(let cy=0;cy<10;cy++)for(let cx=0;cx<10;cx++){
    const x=cx*100,y=cy*100;
    if(!active.some(a=>x<a.x+a.width&&a.x<x+100&&y<a.y+a.height&&a.y<y+100))remaining++;
  }
  const pixels=arr=>arr.reduce((n,a)=>n+a.width*a.height,0);
  const paidPixels=pixels(active.filter(r=>PAID.has(r.status)));
  const heldPixels=pixels(active.filter(r=>r.status==='HELD'));
  return {schema:'BECK/verified-ad-inventory/v1',market:'NZ',market_name:'New Zealand Billboard',
    inventory_source:'verified_registered_supabase',canvas:{width:1000,height:1000},total_pixels:1000000,
    sold_pixels:paidPixels,held_pixels:heldPixels,allocated_pixels:paidPixels+heldPixels,
    total_founding_units:100,remaining_founding_units:remaining,
    campaign_count:active.length,
    // Occupancy includes PAID and HELD space, not only published creative. No PII.
    unavailable_positions:active.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),
    published_positions:active.filter(r=>r.status==='PUBLISHED').map(r=>({id:r.reservation_id,x:r.x,y:r.y,width:r.width,height:r.height})),
    audience_claims_verified:false,payment_claims_verified:false};
}
module.exports={inventory};
