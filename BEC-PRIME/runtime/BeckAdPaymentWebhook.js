'use strict';
const crypto=require('node:crypto');
const {configured}=require('./BeckAdReservationClient');
const SKU='BECK-AD-FOUNDING-100X100';
const ALLOWED=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded']);
function failure(message,statusCode=503){return Object.assign(new Error(message),{statusCode})}
function enabled(env){return env.BECK_AD_WEBHOOK_ENABLED==='true'&&env.BECK_AD_OWNER_RELEASE_APPROVED==='true'}
function signatureVerified(raw,header,secret,nowMs=Date.now()){
 if(!Buffer.isBuffer(raw)||raw.length>64*1024||!secret||!header)return false;
 let ts=null;const signatures=[];
 for(const part of String(header).split(',')){
   const [k,...v]=part.trim().split('=');
   if(k==='t'&&/^\d+$/.test(v.join('=')))ts=Number(v.join('='));
   if(k==='v1'&&/^[a-f0-9]{64}$/i.test(v.join('=')))signatures.push(v.join('='));
 }
 if(!Number.isSafeInteger(ts)||Math.abs(Math.floor(nowMs/1000)-ts)>300||!signatures.length)return false;
 const expected=crypto.createHmac('sha256',secret).update(String(ts)+'.').update(raw).digest();
 return signatures.some(x=>{const b=Buffer.from(x,'hex');return b.length===expected.length&&crypto.timingSafeEqual(expected,b)});
}
async function processStripeEvent(raw,signature,{env=process.env,fetchImpl=globalThis.fetch,now=new Date()}={}){
 if(!enabled(env))throw failure('beck_ad_webhook_disabled');
 if(!env.STRIPE_WEBHOOK_SECRET||!env.STRIPE_SECRET_KEY||!/^sk_live_/.test(env.STRIPE_SECRET_KEY)||
    !/^acct_[A-Za-z0-9]+$/.test(env.BECK_AD_STRIPE_ACCOUNT_ID||''))
   throw failure('beck_ad_webhook_not_configured');
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf())||typeof fetchImpl!=='function')
   throw failure('beck_ad_webhook_unavailable');
 if(!signatureVerified(raw,signature,env.STRIPE_WEBHOOK_SECRET,now.valueOf()))
   throw failure('invalid_stripe_signature',400);
 let event;try{event=JSON.parse(raw.toString('utf8'))}catch{throw failure('invalid_stripe_event',400)}
 if(event.livemode!==true||!ALLOWED.has(event.type))return {received:true,ignored:'not_live_paid_checkout'};
 if(event.account&&event.account!==env.BECK_AD_STRIPE_ACCOUNT_ID)throw failure('wrong_stripe_account',400);
 const s=event.data?.object||{};
 const m=s.metadata||{};
 if(m.product_sku!==SKU||m.product_id!==SKU||m.offer_id!==SKU||
    m.silo!=='ads'||m.source!=='beck_ad_reserved_checkout'||
    !/^[a-f0-9-]{36}$/i.test(m.reservation_id||''))
   return {received:true,ignored:'not_beck_ad_checkout'};
 if(s.livemode!==true||s.payment_status!=='paid'||s.amount_total!==5000||
    String(s.currency||'').toLowerCase()!=='nzd'||!/^cs_live_[A-Za-z0-9_]+$/.test(s.id||'')||
    !/^pi_[A-Za-z0-9_]+$/.test(s.payment_intent||'')||
    !/^evt_[A-Za-z0-9_]+$/.test(event.id||''))throw failure('payment_evidence_invalid',400);
 const headers={authorization:'Bearer '+env.STRIPE_SECRET_KEY,accept:'application/json'};
 let stripeRes;try{
   stripeRes=await fetchImpl('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(s.id),{
     headers,signal:AbortSignal.timeout(8000)});
 }catch{throw failure('stripe_independent_read_unavailable')}
 if(!stripeRes?.ok)throw failure('stripe_independent_read_unavailable');
 let verified;try{verified=await stripeRes.json()}catch{throw failure('stripe_independent_read_invalid')}
 if(!verified||verified.id!==s.id||verified.livemode!==true||verified.payment_status!=='paid'||
    verified.amount_total!==5000||String(verified.currency||'').toLowerCase()!=='nzd'||
    verified.payment_intent!==s.payment_intent||
    ['product_sku','product_id','offer_id','silo','source','reservation_id']
      .some(k=>verified.metadata?.[k]!==m[k]))
   throw failure('stripe_independent_mismatch',400);
 const {base,key}=configured(env);
 let db;try{
   db=await fetchImpl(base+'/rest/v1/rpc/beck_ad_record_paid',{
     method:'POST',
     headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',accept:'application/json'},
     body:JSON.stringify({
       p_reservation_id:m.reservation_id,p_session_id:s.id,p_event_id:event.id,
       p_payment_intent_id:s.payment_intent,p_amount_minor:5000,p_currency:'NZD',
       p_livemode:true
     }),signal:AbortSignal.timeout(8000)});
 }catch{throw failure('payment_receipt_store_unavailable')}
 if(!db?.ok)throw failure('payment_receipt_store_rejected');
 let receipt;try{receipt=await db.json()}catch{throw failure('payment_receipt_invalid')}
 if(!receipt||receipt.reservation_id!==m.reservation_id||
    receipt.checkout_session_id!==s.id||receipt.amount_minor!==5000||
    receipt.currency!=='NZD'||receipt.status!=='PAID_PENDING_CREATIVE_REVIEW')
   throw failure('payment_receipt_invalid');
 return {received:true,payment_recorded:true,receipt_event_id:receipt.event_id,
   publication:'NOT_AUTHORIZED',delivery_verified:false,independent_revenue_verified:false};
}
module.exports={processStripeEvent,signatureVerified,enabled};
