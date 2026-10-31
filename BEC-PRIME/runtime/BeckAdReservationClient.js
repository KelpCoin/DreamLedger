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
  compile([{...placement,status:'APPROVED'}]);
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
    throw Error('beck_ad_reservation_rejected');
  }
  let result;try{result=await response.json()}catch{throw Error('beck_ad_response_invalid')}
  if(!result||typeof result!=='object'||!result.reservation_id||
    result.exhaust!==params.p_exhaust||result.silo!==params.p_silo||
    result.canvas!==params.p_canvas||result.idempotency_key!==params.p_key)
    throw Error('beck_ad_response_invalid');
  if(!['HELD','PAID','APPROVED','PUBLISHED'].includes(result.status)||
     (result.status==='HELD'&&!(Date.parse(result.hold_expires_at)>Date.now())))
    throw Error('beck_ad_reservation_not_active');
  return {reservation_id:result.reservation_id,expires_at:result.hold_expires_at,status:result.status,
    exhaust:result.exhaust,silo:result.silo,canvas:result.canvas,idempotency_key:params.p_key};
}
module.exports={configured,validate,reserve};
