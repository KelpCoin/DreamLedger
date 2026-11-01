'use strict';
const {configured}=require('./BeckAdReservationClient');
function fail(){return Error('beck_ad_checkout_binding_unverified')}
async function bindCheckout({reservation_id,session_id,expires_at},{env=process.env,fetchImpl=globalThis.fetch}={}){
  if(typeof reservation_id!=='string'||!/^[a-f0-9-]{36}$/i.test(reservation_id)||
    typeof session_id!=='string'||!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(session_id)||
    !expires_at||!Number.isFinite(Date.parse(expires_at)))throw fail();
  const {base,key}=configured(env);
  if(typeof fetchImpl!=='function')throw fail();
  let r;try{
    r=await fetchImpl(base+'/rest/v1/rpc/beck_ad_bind_checkout',{
      method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({p_reservation_id:reservation_id,p_session_id:session_id,
        p_session_expires_at:expires_at}),signal:AbortSignal.timeout(8000)});
  }catch{throw fail()}
  if(!r?.ok)throw fail();
  let row;try{row=await r.json()}catch{throw fail()}
  if(!row||row.reservation_id!==reservation_id||row.checkout_session_id!==session_id||
     row.status!=='HELD'||!Number.isFinite(Date.parse(row.hold_expires_at))||
     Date.parse(row.hold_expires_at)<=Date.now())throw fail();
  return {reservation_id,checkout_session_id:session_id,linked:true};
}
module.exports={bindCheckout};
