import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";
const url=Deno.env.get("SUPABASE_URL")!; const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; const stripeKey=Deno.env.get("STRIPE_API_KEY")||Deno.env.get("STRIPE_SECRET_KEY")!;
const admin=createClient(url,serviceRole); const stripe=new Stripe(stripeKey);
Deno.serve(async(req)=>{
 const u=new URL(req.url); const sessionId=u.searchParams.get("session_id");
 if(req.method!=="GET"||!sessionId)return new Response("Missing session_id",{status:400});
 try{
   const session=await stripe.checkout.sessions.retrieve(sessionId);
   if(!session.livemode||session.payment_status!=="paid")return new Response("Payment not settled",{status:409});
   const listingId=String(session.metadata?.marketplace_listing_id||"");
   if(!listingId)return new Response("Not a marketplace order",{status:400});
   const {data:order,error}=await admin.from("marketplace_orders").select("id,buyer_email,payment_status,fulfillment_status,order_state").eq("checkout_session_id",sessionId).eq("listing_id",listingId).single();
   if(error||!order)return new Response("Order settlement not yet visible. Please refresh in a few seconds.",{status:409});
   const esc=(v:string)=>String(v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));
   const state=String(order.fulfillment_status||"pending");
   const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commander Deck Diagnostic</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:20px;background:#0a0b0e;color:#f7f4ee}a,button{color:#0a0b0e;background:#c9a24b;padding:12px 18px;border-radius:8px;text-decoration:none;border:0;font-weight:700;cursor:pointer}code{color:#c9a24b}textarea{width:100%;min-height:320px;background:#12151b;color:#f7f4ee;border:1px solid #3a404b;border-radius:10px;padding:12px;font:14px ui-monospace,monospace;box-sizing:border-box}label{display:block;margin:20px 0 8px;color:#c8cdd5;font-weight:700}.card{background:#11151b;border:1px solid #2c333e;border-radius:14px;padding:18px;margin-top:18px}.muted{color:#a4aab5;font-size:14px}</style></head><body><h1>Commander Deck Diagnostic</h1><p>Payment settled. Order <code>${esc(order.id)}</code> is in the marketplace fulfillment pipeline.</p><div class="card"><p class="muted">Paste your complete Commander decklist below. The system verifies the settled payment before accepting the input.</p><form method="post" action="https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input"><input type="hidden" name="checkout_session_id" value="${esc(sessionId)}"><label for="decklist">Commander decklist</label><textarea id="decklist" name="decklist" minlength="20" maxlength="30000" required placeholder="1 Sol Ring&#10;1 Command Tower&#10;..."></textarea><p><button type="submit">Submit decklist</button></p></form></div><p class="muted">Current fulfillment state: ${esc(state)}. The report is not considered delivered until the marketplace records the verified artifact.</p></body></html>`;
   return new Response(html,{headers:{
     "Content-Type":"text/html; charset=utf-8",
     "Cache-Control":"no-store, private",
     "Referrer-Policy":"no-referrer",
     "X-Content-Type-Options":"nosniff",
     "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action https://wbwgroygjeyukkspnqiy.supabase.co; base-uri 'none'; frame-ancestors 'none'"
   }});
 }catch(e){
   console.error("marketplace-diagnostic-delivery: lookup failed",{name:String(e?.name||"Error")});
   return new Response("Delivery lookup temporarily unavailable. Please retry.",{status:500,headers:{"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}})
 }
});
