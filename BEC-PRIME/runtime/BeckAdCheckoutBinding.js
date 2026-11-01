'use strict';
const {configured}=require('./BeckAdReservationClient');
function fail(){return Error('beck_ad_checkout_binding_unverified')}
async function bindCheckout({reservation_id,session_id,expires_at,title,destination_url,creative_sha256},{env=process.env,fetchImpl=globalThis.fetch}={}){
  if(typeof reservation_id!=='string'||!/^[a-f0-9-]{36}$/i.test(reservation_id)||
    typeof session_id!=='string'||!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(session_id)||
    !expires_at||!Number.isFinite(Date.parse(expires_at))||
    typeof title!=='string'||title.trim().length<1||title.length>80||
    typeof destination_url!=='string'||!destination_url.startsWith('https://')||
    destination_url.length>500||
    typeof creative_sha256!=='string'||!/^[a-f0-9]{64}$/.test(creative_sha256))throw fail();
  const {base,key}=configured(env);
  if(typeof fetchImpl!=='function')throw fail();
  let r;try{
    r=await fetchImpl(base+'/rest/v1/rpc/beck_ad_bind_checkout',{
      method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({p_reservation_id:reservation_id,p_session_id:session_id,
        p_session_expires_at:expires_at,p_title:title,p_destination_url:destination_url,
        p_creative_sha256:creative_sha256}),signal:AbortSignal.timeout(8000)});
  }catch{throw fail()}
  if(!r?.ok)throw fail();
  let row;try{row=await r.json()}catch{throw fail()}
  if(!row||row.reservation_id!==reservation_id||row.checkout_session_id!==session_id||
     row.status!=='HELD'||row.creative_manifest_sha256!==creative_sha256||
    row.creative_review_status!=='PENDING_REVIEW'||!Number.isFinite(Date.parse(row.hold_expires_at))||
     Date.parse(row.hold_expires_at)<=Date.now())throw fail();
  return {reservation_id,checkout_session_id:session_id,linked:true};
}
module.exports={bindCheckout};
