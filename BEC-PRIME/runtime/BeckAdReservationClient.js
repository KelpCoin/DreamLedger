'use strict';
// Server-only Supabase RPC adapter. Never bundle this module into public HTML.
const { compile } = require('./AdInventoryGate');
const DEFAULT_TIMEOUT_MS = 8000;
function configured(env) {
  const base=String(env.SUPABASE_URL||'');
  const key=String(env.SUPABASE_SERVICE_ROLE_KEY||'');
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(base)||key.length<20)
    throw Error('beck_ad_reservation_backend_unavailable');
  return {base:base.replace(/\/$/,''),key};
}
function validate(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('reservation_input_invalid');
  const {placement,idempotency_key}=input;
  if(!placement||!idempotency_key||typeof idempotency_key!=='string'||
     !/^[a-zA-Z0-9:_-]{8,128}$/.test(idempotency_key))throw Error('reservation_key_invalid');
  // A caller cannot silently upgrade draft inventory into an approved claim.
  if(placement.status!=='APPROVED')throw Error('reservation_placement_not_approved');
  compile([placement]);
  if(!/^[a-z0-9_-]{2,80}$/.test(placement.exhaust)||!/^[a-z0-9_-]{2,80}$/.test(placement.silo)||!/^[a-z0-9_-]{2,80}$/.test(placement.canvas_id||''))
    throw Error('reservation_namespace_invalid');
  if(!['NZD','USD'].includes(placement.currency))throw Error('reservation_currency_invalid');
  return {
    p_exhaust:placement.exhaust,p_silo:placement.silo,p_canvas:placement.canvas_id,p_key:idempotency_key,
    p_x:placement.x,p_y:placement.y,p_width:placement.width,p_height:placement.height,
    p_canvas_width:placement.canvas_width,p_canvas_height:placement.canvas_height,
    p_start:placement.start_utc,p_end:placement.end_utc,p_price_minor:placement.price_minor,p_currency:placement.currency,
    p_hold_minutes:60
  };
}

function matchesClaim(row,params) {
  if(!row||typeof row!=='object'||Array.isArray(row)||
     typeof row.reservation_id!=='string'||
     !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.reservation_id))
    return false;
  // The RPC must attest the EXACT claim, not merely the correct canvas/key.
  const fields=[
    ['exhaust','p_exhaust'],['silo','p_silo'],['canvas','p_canvas'],
    ['idempotency_key','p_key'],['x','p_x'],['y','p_y'],
    ['width','p_width'],['height','p_height'],
    ['canvas_width','p_canvas_width'],['canvas_height','p_canvas_height'],
    ['price_minor','p_price_minor'],['currency','p_currency']
  ];
  if(!fields.every(([field,param])=>row[field]===params[param]))return false;
  const start=Date.parse(row.campaign_start),end=Date.parse(row.campaign_end);
  return Number.isFinite(start)&&Number.isFinite(end)&&
    start===Date.parse(params.p_start)&&end===Date.parse(params.p_end);
}

async function reserve(input,{env=process.env,fetchImpl=globalThis.fetch,timeoutMs=DEFAULT_TIMEOUT_MS}={}) {
  const params=validate(input);
  const {base,key}=configured(env);
  if(typeof fetchImpl!=='function')throw Error('beck_ad_fetch_unavailable');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)throw Error('beck_ad_timeout_invalid');
  let response;
  try {
    response=await fetchImpl(base+'/rest/v1/rpc/beck_ad_reserve_tile',{
      method:'POST',
      headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify(params),signal:AbortSignal.timeout(timeoutMs)
    });
  } catch {throw Error('beck_ad_reservation_network_unavailable');}
  if(!response||!response.ok) {
    // Never propagate raw PostgREST errors, which may contain internal details.
    if(response?.status===409)throw Error('beck_ad_inventory_conflict');
    // PostgREST reports the SQL P0001 overlap exception as HTTP 400.
    if(response?.status===400){
      let payload=null;try{payload=await response.json()}catch{}
      if(payload?.message==='inventory_overlap')throw Error('beck_ad_inventory_conflict');
      if(payload?.message==='idempotency_conflict')throw Error('beck_ad_idempotency_conflict');
    }
    throw Error('beck_ad_reservation_rejected');
  }
  let result;try{result=await response.json()}catch{throw Error('beck_ad_response_invalid')}
  if(!matchesClaim(result,params))throw Error('beck_ad_response_invalid');
  const expiry=Date.parse(result.hold_expires_at);
  if(!['HELD','PAID','APPROVED','PUBLISHED'].includes(result.status)||
     !Number.isFinite(expiry)||
     (result.status==='HELD'&&!(expiry>Date.now())))
    throw Error('beck_ad_reservation_not_active');
  return {reservation_id:result.reservation_id,expires_at:result.hold_expires_at,status:result.status,
    exhaust:result.exhaust,silo:result.silo,canvas:result.canvas,idempotency_key:params.p_key};
}

async function lookupReservation({exhaust,silo,canvas,idempotency_key},
  {env=process.env,fetchImpl=globalThis.fetch}={}){
  for(const v of [exhaust,silo,canvas])
    if(typeof v!=='string'||!/^[a-z0-9_-]{2,80}$/.test(v))throw Error('beck_ad_reservation_lookup_invalid');
  if(typeof idempotency_key!=='string'||!/^[A-Za-z0-9:_-]{8,128}$/.test(idempotency_key))
    throw Error('beck_ad_reservation_lookup_invalid');
  const {base,key}=configured(env);
  if(typeof fetchImpl!=='function')throw Error('beck_ad_reservation_lookup_unavailable');
  const u=new URL(base+'/rest/v1/beck_ad_reservations');
  const params={select:'reservation_id,status,exhaust,silo,canvas,idempotency_key,x,y,width,height,canvas_width,canvas_height,price_minor,currency,campaign_start,campaign_end,hold_expires_at,checkout_session_id,checkout_session_expires_at',
    exhaust:'eq.'+exhaust,silo:'eq.'+silo,canvas:'eq.'+canvas,
    idempotency_key:'eq.'+idempotency_key,limit:'2'};
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  let res;try{res=await fetchImpl(u.toString(),{
    headers:{apikey:key,authorization:'Bearer '+key,accept:'application/json'},
    signal:AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  })}catch{throw Error('beck_ad_reservation_lookup_unavailable')}
  if(!res?.ok)throw Error('beck_ad_reservation_lookup_unavailable');
  let rows;try{rows=await res.json()}catch{throw Error('beck_ad_reservation_lookup_unavailable')}
  if(!Array.isArray(rows)||rows.length>1)throw Error('beck_ad_reservation_lookup_unavailable');
  if(!rows.length)return null;
  const row=rows[0];
  if(!row||row.exhaust!==exhaust||row.silo!==silo||row.canvas!==canvas||
     row.idempotency_key!==idempotency_key||
     !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.reservation_id||''))
    throw Error('beck_ad_reservation_lookup_unavailable');
  return row;
}

module.exports={configured,validate,reserve,lookupReservation};
