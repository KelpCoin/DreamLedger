'use strict';
// Fail-closed Stripe entitlement verification. Fixed provider endpoint; no customer PII in response.
const SESSION=/^cs_(?:live|test)_[a-zA-Z0-9]+$/;
function verifyFactory({fetcher=fetch,env=process.env}={}){
 return async function verify(sessionId){
  if(!env.STRIPE_SECRET_KEY||!env.CSV_RESCUE_LINK_ID||!env.CSV_RESCUE_PRICE_ID) return {code:503,body:{ok:false,reason:'DELIVERY_NOT_CONFIGURED'}};
  if(typeof sessionId!=='string'||sessionId.length>150||!SESSION.test(sessionId))return {code:400,body:{ok:false,reason:'INVALID_SESSION'}};
  try{
   const auth='Bearer '+env.STRIPE_SECRET_KEY;
   const retrieve=async url=>{const r=await fetcher(url,{headers:{authorization:auth},signal:AbortSignal.timeout(7000),redirect:'error'});if(!r.ok)throw Error('PROVIDER_UNAVAILABLE');return r.json();};
   const session=await retrieve('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId));
   if(session.livemode!==true||session.status!=='complete'||session.payment_status!=='paid'||session.mode!=='payment'||session.currency!=='nzd'||session.amount_total!==2900||session.payment_link!==env.CSV_RESCUE_LINK_ID)return {code:403,body:{ok:false,reason:'NOT_ENTITLED'}};
   const items=await retrieve('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'/line_items?limit=10');
   if(!Array.isArray(items.data)||items.data.length!==1||items.data[0].price?.id!==env.CSV_RESCUE_PRICE_ID||items.data[0].quantity!==1)return {code:403,body:{ok:false,reason:'NOT_ENTITLED'}};
   return {code:200,body:{ok:true,sku:'BECK-CSV-RESCUE-29',entitlement:'browser_local_toolkit',verified_at:new Date().toISOString()}};
  }catch{return {code:503,body:{ok:false,reason:'PAYMENT_VERIFICATION_UNAVAILABLE'}};}
 };
}
module.exports={verifyFactory};