// Read-only regional capacity summary. Never expose unpublished creative,
// customer contact details, or allow an unauthenticated reservation from this API.
const MARKET_NAMES:any={
 GLOBAL:'Global Billboard',NZ:'New Zealand Billboard',AU:'Australia Billboard',
 ZA:'South Africa Billboard',AMERICAS:'Americas Billboard',EUROPE:'Europe Billboard'
};
const LIMIT=100;
function reply(body:unknown,status=200){
 return new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff'
 }});
}
function units(w:number,h:number){
 return Math.max(1,Math.ceil(w/100)*Math.ceil(h/100));
}
export default async function handler(request:Request){
 if(request.method!=='GET')return reply({error:'METHOD_NOT_ALLOWED'},405);
 const url=new URL(request.url);
 const market=String(url.searchParams.get('market')||'GLOBAL').toUpperCase();
 if(!Object.prototype.hasOwnProperty.call(MARKET_NAMES,market))
  return reply({error:'UNSUPPORTED_BILLBOARD_MARKET'},400);
 const base=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 if(!/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co\/?$/.test(base)||!key)
  return reply({error:'BILLBOARD_CAPACITY_NOT_CONFIGURED'},503);
 try{
  // Only geometric fields are pulled; no personal/sensitive data leaves the DB.
  const query='/rest/v1/billboard_campaigns?market=eq.'+encodeURIComponent(market)+
   '&status=in.(PUBLISHED,PAID_PENDING_REVIEW)&select=campaign_id,market,status,x,y,width,height&limit=1000';
  const response=await fetch(base.replace(/\/$/,'')+query,{
   headers:{apikey:key,authorization:'Bearer '+key,accept:'application/json'},
   cache:'no-store',signal:AbortSignal.timeout(8500)
  });
  if(!response.ok)return reply({error:'BILLBOARD_CAPACITY_UNAVAILABLE'},503);
  const rows=await response.json();
  if(!Array.isArray(rows))return reply({error:'BILLBOARD_CAPACITY_INVALID'},502);
  let used=0,publicCount=0,heldCount=0;
  const publicGeometry=[];
  for(const row of rows){
   const w=Number(row.width),h=Number(row.height);
   if(!Number.isInteger(w)||!Number.isInteger(h)||w<100||h<100)
    return reply({error:'BILLBOARD_GEOMETRY_INVALID'},503);
   used+=units(w,h);
   if(row.status==='PUBLISHED'){
    publicCount++;
    publicGeometry.push({x:row.x,y:row.y,width:w,height:h});
   }else if(row.status==='PAID_PENDING_REVIEW')heldCount++;
  }
  if(used>LIMIT)return reply({error:'BILLBOARD_ALLOCATION_CONFLICT'},503);
  return reply({schema:'dreamledger/billboard-capacity/v2',
   market,market_name:MARKET_NAMES[market],total_pixels:1000000,
   total_founding_units:LIMIT,used_founding_units:used,
   remaining_founding_units:LIMIT-used,published_placements:publicCount,
   held_pending_review_count:heldCount,published_geometry:publicGeometry,
   checkout_available:false,checkout_activation_verified:false,
   physical_dooh_screen_inventory:false,
   note:'Capacity is informational and not a reservation or offer. Pending customer submissions are private.'});
 }catch{return reply({error:'BILLBOARD_CAPACITY_UNAVAILABLE'},503);}
}
