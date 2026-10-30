'use strict';
// Fail-closed Stripe entitlement verification. Fixed provider endpoint; no customer PII in response.
const SESSION=/^cs_(?:live|test)_[a-zA-Z0-9]+$/;
function verifyFactory({fetcher=fetch,env=process.env}={}){
 return async function verify(sessionId){
  if(!env.STRIPE_SECRET_KEY||!env.CSV_RESCUE_LINK_ID||!env.CSV_RESCUE_PRICE_ID||!env.CSV_RESCUE_ACCOUNT_ID) return {code:503,body:{ok:false,reason:'DELIVERY_NOT_CONFIGURED'}};
  if(typeof sessionId!=='string'||sessionId.length>150||!SESSION.test(sessionId))return {code:400,body:{ok:false,reason:'INVALID_SESSION'}};
  try{
   const auth='Bearer '+env.STRIPE_SECRET_KEY;
   const retrieve=async url=>{const r=await fetcher(url,{headers:{authorization:auth},signal:AbortSignal.timeout(7000),redirect:'error'});if(!r.ok)throw Error('PROVIDER_UNAVAILABLE');return r.json();};
   const account=await retrieve('https://api.stripe.com/v1/account');
   if(account.id!==env.CSV_RESCUE_ACCOUNT_ID)return {code:403,body:{ok:false,reason:'ACCOUNT_MISMATCH'}};
   const session=await retrieve('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId));
   if(session.livemode!==true||session.status!=='complete'||session.payment_status!=='paid'||session.mode!=='payment'||session.currency!=='nzd'||session.amount_total!==2900||session.payment_link!==env.CSV_RESCUE_LINK_ID)return {code:403,body:{ok:false,reason:'NOT_ENTITLED'}};
   const items=await retrieve('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'/line_items?limit=10');
   if(items.has_more===true||!Array.isArray(items.data)||items.data.length!==1||items.data[0].price?.id!==env.CSV_RESCUE_PRICE_ID||items.data[0].quantity!==1)return {code:403,body:{ok:false,reason:'NOT_ENTITLED'}};
   if(session.metadata?.silo!=='data_tools'||session.metadata?.sku!=='BECK-CSV-RESCUE-29')return {code:403,body:{ok:false,reason:'SILO_MISMATCH'}};
   if(typeof session.payment_intent!=='string'||!/^pi_[A-Za-z0-9]+$/.test(session.payment_intent))return {code:403,body:{ok:false,reason:'PAYMENT_EVIDENCE_MISSING'}};
   const payment=await retrieve('https://api.stripe.com/v1/payment_intents/'+encodeURIComponent(session.payment_intent)+'?expand[]=latest_charge');
   const charge=payment.latest_charge;
   if(payment.id!==session.payment_intent||payment.status!=='succeeded'||payment.currency!=='nzd'||payment.amount_received!==2900||payment.livemode!==true||!charge||typeof charge!=='object'||charge.payment_intent!==payment.id||charge.paid!==true||charge.captured!==true||charge.currency!=='nzd'||charge.amount_captured!==2900||charge.livemode!==true||charge.refunded!==false||charge.amount_refunded!==0||charge.disputed!==false)return {code:403,body:{ok:false,reason:'PAYMENT_REVOKED_OR_UNCONFIRMED'}};
   return {code:200,body:{ok:true,sku:'BECK-CSV-RESCUE-29',entitlement:'browser_local_toolkit',verified_at:new Date().toISOString()}};
  }catch{return {code:503,body:{ok:false,reason:'PAYMENT_VERIFICATION_UNAVAILABLE'}};}
 };
}
module.exports={verifyFactory};