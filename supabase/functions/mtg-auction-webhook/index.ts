// MTG Stripe webhook. Raw request signature verified before touching the external ledger.
// Never infer a paid order from a client redirect or a client-submitted ID.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const hash=async(raw:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async req=>{
 if(req.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
 const key=Deno.env.get("STRIPE_SECRET_KEY"),secret=Deno.env.get("MTG_AUCTION_STRIPE_WEBHOOK_SECRET"),
 base=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!key||!secret||!base||!service)return reply({error:"WEBHOOK_NOT_CONFIGURED"},503);
 const signature=req.headers.get("stripe-signature");
 if(!signature)return reply({error:"SIGNATURE_REQUIRED"},400);
 const raw=await req.text();if(raw.length>1024*1024)return reply({error:"PAYLOAD_TOO_LARGE"},413);
 const stripe=new Stripe(key,{apiVersion:"2025-06-30.basil"});
 let event:Stripe.Event;
 try{event=await stripe.webhooks.constructEventAsync(raw,signature,secret)}
 catch{return reply({error:"BAD_STRIPE_SIGNATURE"},400)}
 // This integration remains a TEST-only payment lane; no real-money recognition.
 if(event.livemode!==false||!key.startsWith("sk_test_"))
   return reply({error:"LIVE_AUCTION_EVENTS_NOT_AUTHORIZED"},503);
 // This endpoint is platform-MTG-only; Connect events have a separate owner.
 if(event.account)return reply({received:true,ignored:"connected_account"});
 const admin=createClient(base,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const payloadHash=await hash(raw);
 if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
  const s=event.data.object as Stripe.Checkout.Session;
  if(s.metadata?.silo!=="mtg"||!s.metadata?.mtg_order_id)return reply({received:true,ignored:"not_mtg_v2"});
  if(s.payment_status!=="paid")return reply({received:true,ignored:"not_paid"});
  const paymentIntent=typeof s.payment_intent==="string"?s.payment_intent:s.payment_intent?.id||null;
  const {data:mtgOrder,error:orderError}=await admin.from("mtg_auction_orders_v2")
    .select("id,stripe_session,amount_cents,currency")
    .eq("id",s.metadata.mtg_order_id).maybeSingle();
  if(orderError)return reply({error:"ORDER_LOOKUP_RETRY"},503);
  if(!mtgOrder||mtgOrder.stripe_session!==s.id)return reply({error:"MTG_ORDER_SESSION_RECONCILIATION_REQUIRED"},503);
  if(mtgOrder.amount_cents!==s.amount_total||mtgOrder.currency.toLowerCase()!==s.currency)
    return reply({error:"ORDER_AMOUNT_CURRENCY_MISMATCH"},409);
  const {data,error}=await admin.rpc("mtg_auction_reconcile_v2",{
   p_event_id:event.id,p_event_type:event.type,p_session:s.id,
   p_amount_cents:s.amount_total,p_currency:s.currency,p_payload_sha256:payloadHash,
   p_payment_intent:paymentIntent
  });
  if(error){console.error("MTG_RECONCILE_RETRY",error.code);return reply({error:"RECONCILIATION_RETRY"},503)}
  return reply({received:true,result:data});
 }
 if(event.type==="charge.refunded"){
  const c=event.data.object as Stripe.Charge;
  const paymentIntent=typeof c.payment_intent==="string"?c.payment_intent:c.payment_intent?.id||null;
  if(!paymentIntent)return reply({received:true,ignored:"no_payment_intent"});
  // Never record unrelated platform charges (other silos) in the MTG external ledger.
  const {data:mtgOrder,error:orderError}=await admin.from("mtg_auction_orders_v2")
    .select("id,amount_cents,currency").eq("stripe_payment_intent",paymentIntent).maybeSingle();
  if(orderError)return reply({error:"ORDER_LOOKUP_RETRY"},503);
  if(!mtgOrder)return reply({received:true,ignored:"not_an_mtg_auction_order"});
  const {data,error}=await admin.rpc("mtg_auction_refund_reconcile_v2",{
   p_event_id:event.id,p_payment_intent:paymentIntent,
   p_refunded_cents:c.amount_refunded,p_currency:c.currency,p_payload_sha256:payloadHash
  });
  if(error){console.error("MTG_REFUND_RETRY",error.code);return reply({error:"RECONCILIATION_RETRY"},503)}
  return reply({received:true,result:data});
 }
 return reply({received:true,ignored:"not_target_event"});
});
