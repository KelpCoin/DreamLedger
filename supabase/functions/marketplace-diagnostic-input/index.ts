import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const STRIPE_API_KEY=Deno.env.get("STRIPE_API_KEY")||Deno.env.get("STRIPE_SECRET_KEY")||"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
const stripe=new Stripe(STRIPE_API_KEY);
Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("POST only",{status:405});
  try{
    const ct=req.headers.get("content-type")||"";
    const body=ct.includes("application/json")?await req.json():Object.fromEntries(new URLSearchParams(await req.text()).entries());
    const sessionId=String(body.checkout_session_id||body.session_id||"").trim();
    const decklist=String(body.decklist||"");
    if(!sessionId||decklist.length<20||decklist.length>30000) return Response.json({error:"invalid input"},{status:400});
    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.livemode!==true||session.payment_status!=="paid") return Response.json({error:"live payment not settled"},{status:409});
    const email=(session.customer_details?.email||session.customer_email||"").trim().toLowerCase();
    const listingId=String(session.metadata?.marketplace_listing_id||"");
    const rawSku=String(session.metadata?.dreamledger_sku||session.metadata?.sku_id||session.metadata?.sku||"").trim().toUpperCase();
    const sku=rawSku==="CMD-DIAG-29"?"COMMANDER-DECK-DIAGNOSTIC-001":rawSku;
    if(!listingId||sku!=="COMMANDER-DECK-DIAGNOSTIC-001") return Response.json({error:"not a marketplace diagnostic checkout"},{status:400});
    const {data:fulfillment,error:lookupError}=await db.from("marketplace_fulfillments").select("fulfillment_id,status").eq("metadata->>stripe_checkout_session_id",sessionId).eq("metadata->>sku","COMMANDER-DECK-DIAGNOSTIC-001").maybeSingle();
    if(lookupError) return Response.json({error:"fulfillment lookup failed"},{status:500});
    if(!fulfillment) return Response.json({error:"fulfillment not found yet; webhook settlement may still be processing"},{status:409});
    const {error}=await db.rpc("marketplace_submit_diagnostic_input",{p_fulfillment_id:fulfillment.fulfillment_id,p_customer_email:email,p_decklist:decklist});
    if(error) {
      console.error("marketplace-diagnostic-input: submission RPC failed", { code: error.code || "UNKNOWN" });
      return Response.json({error:"decklist submission failed; please retry"},{status:409});
    }
    const accept=req.headers.get("accept")||"";
    if(accept.includes("text/html")) return new Response("<h1>Decklist received</h1><p>Your diagnostic is queued for analysis. You can refresh the checkout delivery page for status.</p>",{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store, private","referrer-policy":"no-referrer","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; base-uri 'none'; frame-ancestors 'none'"}});
    return Response.json({ok:true,fulfillment_id:fulfillment.fulfillment_id,status:"queued"});
  }catch(error){
    console.error("marketplace-diagnostic-input: unhandled failure", { name: String(error?.name || "Error") });
    return Response.json({error:"submission failed; please retry"},{status:500});
  }
});
