// Stripe Checkout creation for confirmed MTG auction winners only.
// Protected by JWT, trusted database order, and explicit release gate.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
 if(Deno.env.get("MTG_AUCTION_PAYMENTS_ENABLED")!=="true")return reply({error:"PAYMENTS_APPROVAL_GATE_CLOSED"},503);
 const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const pub=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
 const stripeKey=Deno.env.get("STRIPE_SECRET_KEY");
 // Until NZ legal/payment routing and connected-seller responsibility are signed off,
 // only Stripe TEST mode is permitted, regardless of the payment feature flag.
 if(Deno.env.get("MTG_AUCTION_PAYMENT_ENV")!=="test"||!stripeKey?.startsWith("sk_test_"))
   return reply({error:"LIVE_THIRD_PARTY_FUNDS_NOT_AUTHORIZED"},503);
 if(!base||!key||!pub||!stripeKey)return reply({error:"CONFIGURATION_INCOMPLETE"},503);
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer .+/.test(bearer))return reply({error:"LOGIN_REQUIRED"},401);
 const identity=createClient(base,pub,{global:{headers:{Authorization:bearer}}});
 const {data:{user},error:authError}=await identity.auth.getUser();
 if(authError||!user||!user.email_confirmed_at)return reply({error:"VERIFIED_EMAIL_REQUIRED"},403);
 let data:any;try{data=await req.json()}catch{return reply({error:"INVALID_JSON"},400)}
 const orderId=String(data?.order_id||"");
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(orderId))return reply({error:"INVALID_ORDER_ID"},422);
 const admin=createClient(base,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:order,error:dbError}=await admin.from("mtg_auction_orders_v2")
 .select("id,auction_id,buyer_id,seller_id,amount_cents,currency,status,stripe_session")
 .eq("id",orderId).eq("buyer_id",user.id).maybeSingle();
 if(dbError)return reply({error:"ORDER_READ_FAILED"},503);
 if(!order||order.status!=="awaiting_checkout")return reply({error:"ORDER_NOT_PAYABLE"},409);
 if(order.currency!=="NZD"||!Number.isSafeInteger(Number(order.amount_cents))||Number(order.amount_cents)<100)return reply({error:"PRICE_NOT_VERIFIED"},409);
 const {data:lot,error:lotError}=await admin.from("mtg_auction_lots_v2").select("id,status,title").eq("id",order.auction_id).single();
 if(lotError||lot?.status!=="awaiting_payment")return reply({error:"LOT_NOT_PAYABLE"},409);
 const stripe=new Stripe(stripeKey,{apiVersion:"2025-06-30.basil"});
 try{
  if(order.stripe_session){
   const existing=await stripe.checkout.sessions.retrieve(order.stripe_session);
   if(existing.status!=="open"||!existing.url)return reply({error:"CHECKOUT_EXPIRED_REVIEW_REQUIRED"},409);
   return reply({checkout_url:existing.url,session_id:existing.id});
  }
  // Order ID uniquely fences Stripe retries and replays.
  const session=await stripe.checkout.sessions.create({
   mode:"payment",client_reference_id:order.id,
   line_items:[{price_data:{currency:"nzd",unit_amount:Number(order.amount_cents),
    product_data:{name:lot.title||"MTG verified auction lot"}},quantity:1}],
   metadata:{mtg_order_id:order.id,mtg_auction_id:order.auction_id,silo:"mtg"},
   payment_intent_data:{metadata:{mtg_order_id:order.id,silo:"mtg"}},
   success_url:"https://dreamledger.org/mtg/auctions/?payment=processing",
   cancel_url:"https://dreamledger.org/mtg/auctions/?payment=cancelled"
  },{idempotencyKey:"mtg-v2-order-"+order.id+"-"+order.amount_cents});
  if(!session.url)return reply({error:"STRIPE_CHECKOUT_NO_URL"},503);
  const {error:bindError}=await admin.rpc("mtg_auction_bind_session_v2",{p_order:order.id,p_session:session.id});
  if(bindError)return reply({error:"CHECKOUT_BINDING_REQUIRES_REVIEW"},503);
  return reply({checkout_url:session.url,session_id:session.id});
 }catch(err){console.error("MTG_CHECKOUT_FAILURE",String((err as Error)?.message||"unknown"));return reply({error:"CHECKOUT_UNAVAILABLE"},503)}
});
