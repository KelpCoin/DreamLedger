// Customer-facing checkout status. Navigation only: no entitlement writes.
(function(){
'use strict';
const title=document.getElementById('return-title');
const detail=document.getElementById('return-detail');
const next=document.getElementById('return-next');
const sid=new URLSearchParams(location.search).get('session_id')||'';
const valid=/^cs_(live|test)_[A-Za-z0-9]{10,180}$/.test(sid);
let attempts=0;
function show(h,p){title.textContent=h;detail.textContent=p;}
if(!valid){show('Your checkout is not verified.','No valid checkout reference was supplied. Keep your payment provider receipt or contact support.');return;}
async function check(){
 attempts++;
 try{
  const abort=new AbortController();
  const cutoff=setTimeout(()=>abort.abort(),8500);
  let resp;
  try{resp=await fetch('/api/checkout-status?session_id='+encodeURIComponent(sid),{credentials:'same-origin',cache:'no-store',signal:abort.signal,headers:{Accept:'application/json'}});}
  finally{clearTimeout(cutoff);}
  const data=await resp.json();
  switch(data.state){
   case 'paid_recorded':
    show('Payment verified.','The payment and order record have been matched. Continue through the verified intake route to submit your decklist.');
    next.hidden=false;
    next.href='https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-delivery?session_id='+encodeURIComponent(sid);
    return;
   case 'paid_pending_record':
    show('Payment confirmed. Your access will appear shortly.','Stripe reports paid; we are waiting for the webhook-backed order record. This page does not grant access.');
    break;
   case 'awaiting_payment':
    show('Payment is not confirmed.','We cannot confirm a completed payment for this checkout. Check your provider receipt before paying again.');
    return;
   case 'product_mismatch':
    show('This order needs a verification check.','The purchased item does not match the expected diagnostic contract. No access was granted. Please contact support.');
    return;
   case 'invalid_session':
    show('Checkout could not be verified.','Please check the original provider receipt or contact support.');
    return;
   default:
    show('Still checking your checkout.','Verification is temporarily unavailable. If you have a provider receipt, keep it. No access has been granted.');
  }
 }catch{show('Still checking your checkout.','We could not reach the verification service. Keep your provider receipt and do not pay twice.');}
 if(attempts<6)setTimeout(check,4000);
 else detail.textContent+=' You can revisit this page later, or use the support link below.';
}
check();
})();
