'use strict';
// Provider-verified Stripe expiry reconciler. Server-only. Never use client input as payment evidence.
const crypto=require('node:crypto');
const {configured}=require('./BeckAdReservationClient');
function fail(message){return Error('beck_ad_expiry_'+message)}
async function reconcileExpiredCheckout(reservation,{env=process.env,fetchImpl=globalThis.fetch,now=new Date()}={}){
 if(env.BECK_AD_EXPIRY_RECONCILIATION_ENABLED!=='true')throw fail('disabled');
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))throw fail('clock_invalid');
 if(!reservation||reservation.status!=='HELD'||
    !/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(reservation.reservation_id||'')||
    !/^cs_(test|live)_[A-Za-z0-9_]+$/.test(reservation.checkout_session_id||'')||
    !/^[a-f0-9]{64}$/.test(reservation.creative_manifest_sha256||'')||
    !Number.isFinite(Date.parse(reservation.checkout_session_expires_at))||
    Date.parse(reservation.checkout_session_expires_at)>=now.valueOf())
    throw fail('not_eligible');
 const key=String(env.STRIPE_SECRET_KEY||'');
 if(!/^sk_(test|live)_/.test(key))throw fail('not_configured');
 const {base,key:dbkey}=configured(env);
 if(!Number.isFinite(now.valueOf())||typeof fetchImpl!=='function')throw fail('not_configured');
 const expectedLive=key.startsWith('sk_live_');
 let response;
 try{
  response=await fetchImpl('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(reservation.checkout_session_id),{
   method:'GET',headers:{authorization:'Bearer '+key,accept:'application/json'},
   signal:AbortSignal.timeout(8000)
  });
 }catch{throw fail('provider_unavailable')}
 if(!response?.ok)throw fail('provider_unavailable');
 let session;try{session=await response.json()}catch{throw fail('provider_invalid')}
 if(!session||session.id!==reservation.checkout_session_id||
    session.status!=='expired'||session.payment_status!=='unpaid'||
    session.livemode!==expectedLive||
    session.metadata?.reservation_id!==reservation.reservation_id||
    session.metadata?.product_sku!=='BECK-AD-FOUNDING-100X100'||
    session.metadata?.source!=='beck_ad_reserved_checkout'||
    session.metadata?.creative_sha256!==reservation.creative_manifest_sha256)
   throw fail('provider_mismatch');
 const record={
  session_id:session.id,status:session.status,payment_status:session.payment_status,
  livemode:session.livemode,reservation_id:reservation.reservation_id,
  creative_sha256:session.metadata.creative_sha256
 };
 const digest=crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex');
 let db;try{
  db=await fetchImpl(base+'/rest/v1/rpc/beck_ad_release_expired_checkout',{
   method:'POST',
   headers:{apikey:dbkey,authorization:'Bearer '+dbkey,'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({p_reservation_id:reservation.reservation_id,
     p_checkout_session_id:session.id,p_status:'expired',p_payment_status:'unpaid',
     p_sha256:digest,p_checked_at:now.toISOString()}),
   signal:AbortSignal.timeout(8000)
  });
 }catch{throw fail('store_unavailable')}
 if(!db?.ok)throw fail('store_rejected');
 let proof;try{proof=await db.json()}catch{throw fail('store_invalid')}
 if(!proof||proof.reservation_id!==reservation.reservation_id||
    proof.checkout_session_id!==session.id||
    proof.reconciliation_sha256!==digest||proof.provider_status!=='expired'||
    proof.provider_payment_status!=='unpaid')throw fail('store_invalid');
 return {reservation_id:reservation.reservation_id,
   released_after_provider_verification:true,
   paid:false,delivery_verified:false,provider_evidence_sha256:digest};
}
module.exports={reconcileExpiredCheckout};
