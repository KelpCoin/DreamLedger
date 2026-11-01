import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";
const url=Deno.env.get("SUPABASE_URL")||""; const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(url,serviceRole);
function pickStripeApiKey(apiKey: unknown, secretKey: unknown): string | null {
 const primary = typeof apiKey === "string" ? apiKey.trim() : "";
 if (primary.length > 0) return primary;
 const fallback = typeof secretKey === "string" ? secretKey.trim() : "";
 if (fallback.length > 0) return fallback;
 return null;
}
function getStripe(): Stripe | null {
 const key = pickStripeApiKey(Deno.env.get("STRIPE_API_KEY"), Deno.env.get("STRIPE_SECRET_KEY"));
 if (!key) return null;
 return new Stripe(key);
}

const CANONICAL_SKU="COMMANDER-DECK-DIAGNOSTIC-001";
const CANONICAL_PRICE="price_1UFFY1EGgEAnUFF9Yq03zIa7";
const CANONICAL_PRODUCT="prod_V6iVKl9HgFpzRU";
const REPORT_BUCKET="marketplace-fulfillment";
const FIRST_PARTY=new Set(["https://dreamledger.org","https://www.dreamledger.org"]);
const SESSION_ID=/^cs_live_[A-Za-z0-9]{10,180}$/;
function reportJson(status:number, payload:unknown, origin:string):Response {
 const headers:Record<string,string>={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store", "referrer-policy":"no-referrer",
  "x-content-type-options":"nosniff","vary":"Origin"
 };
 if(FIRST_PARTY.has(origin))headers["access-control-allow-origin"]=origin;
 return new Response(JSON.stringify(payload),{status,headers});
}
function canonicalPaid(session:any):boolean {
 const lines=session?.line_items?.data;
 if(!Array.isArray(lines)||lines.length!==1||session.line_items.has_more)return false;
 const line=lines[0],price=line?.price,product=price?.product;
 return session.livemode===true&&session.mode==="payment"&&
  session.status==="complete"&&session.payment_status==="paid"&&
  session.currency==="nzd"&&session.amount_total===2900&&session.amount_subtotal===2900&&
  session.metadata?.sku_id===CANONICAL_SKU&&
  !!session.metadata?.marketplace_listing_id&&line.quantity===1&&
  price?.id===CANONICAL_PRICE&&price?.currency==="nzd"&&price?.unit_amount===2900&&
  price?.lookup_key===CANONICAL_SKU&&price?.metadata?.dreamledger_sku===CANONICAL_SKU&&
  product?.id===CANONICAL_PRODUCT&&product?.metadata?.dreamledger_sku===CANONICAL_SKU;
}
async function guestReport(req:Request,stripe:Stripe,origin:string):Promise<Response>{
 if(!FIRST_PARTY.has(origin))return reportJson(403,{error:"ORIGIN_DENIED"},origin);
 if(!(req.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
  return reportJson(415,{error:"JSON_REQUIRED"},origin);
 let body:any;
 try{
  const raw=await req.text();
  if(new TextEncoder().encode(raw).length>1024)return reportJson(413,{error:"REQUEST_TOO_LARGE"},origin);
  body=JSON.parse(raw);
 }catch{return reportJson(400,{error:"INVALID_JSON"},origin);}
 const sid=typeof body?.session_id==="string"?body.session_id:"";
 const email=typeof body?.buyer_email==="string"?body.buyer_email.trim().toLowerCase():"";
 if(!SESSION_ID.test(sid)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return reportJson(400,{error:"INVALID_REPORT_REQUEST"},origin);
 try{
  const session=await stripe.checkout.sessions.retrieve(sid,{expand:["line_items.data.price.product"]});
  if(session.id!==sid||!canonicalPaid(session))
   return reportJson(409,{error:"REPORT_NOT_ELIGIBLE"},origin);
  const checkoutEmail=String(session.customer_details?.email||session.customer_email||"").trim().toLowerCase();
  if(!checkoutEmail||checkoutEmail!==email)
   return reportJson(403,{error:"REPORT_ACCESS_DENIED"},origin);
  if(typeof session.payment_intent!=="string")
   return reportJson(409,{error:"PAYMENT_NOT_CONFIRMED"},origin);
  const pi=await stripe.paymentIntents.retrieve(session.payment_intent,{expand:["latest_charge"]});
  const charge=pi.latest_charge;
  if(pi.status!=="succeeded"||pi.currency!=="nzd"||pi.amount_received!==2900||
     !charge||typeof charge!=="object"||charge.paid!==true||charge.refunded===true||
     charge.disputed===true||charge.amount_refunded!==0)
   return reportJson(409,{error:"PAYMENT_NOT_CONFIRMED"},origin);
  const listing=String(session.metadata.marketplace_listing_id);
  const {data:order,error:oe}=await admin.from("marketplace_orders")
   .select("id,buyer_email,payment_status,fulfillment_status,order_state")
   .eq("checkout_session_id",sid).eq("listing_id",listing).single();
  if(oe||!order||String(order.buyer_email||"").trim().toLowerCase()!==email||
     order.payment_status!=="paid"||order.fulfillment_status!=="fulfilled"||
     !["paid","fulfillment","complete"].includes(String(order.order_state)))
   return reportJson(409,{error:"REPORT_NOT_READY"},origin);
  const {data:artifact,error:fe}=await admin.from("marketplace_fulfillments")
   .select("fulfillment_id,evidence_ref,status").eq("order_id",order.id)
   .eq("status","fulfilled").limit(1).maybeSingle();
  if(fe||!artifact||artifact.status!=="fulfilled")
   return reportJson(409,{error:"REPORT_NOT_READY"},origin);
  const fid=String(artifact.fulfillment_id||"");
  if(!/^[a-zA-Z0-9-]{16,64}$/.test(fid)||
     artifact.evidence_ref!==REPORT_BUCKET+"/"+fid+"/report.md")
   return reportJson(409,{error:"REPORT_EVIDENCE_INVALID"},origin);
  const path=fid+"/report.md";
  const storage=admin.storage.from(REPORT_BUCKET);
  const {data:blob,error:downloadError}=await storage.download(path);
  if(downloadError||!blob)return reportJson(409,{error:"REPORT_ARTIFACT_UNAVAILABLE"},origin);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(bytes.byteLength===0||bytes.byteLength>1048576)
   return reportJson(409,{error:"REPORT_ARTIFACT_INVALID"},origin);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
  const {data:signed,error:signError}=await storage.createSignedUrl(path,60);
  if(signError||!signed?.signedUrl)
   return reportJson(503,{error:"REPORT_LINK_UNAVAILABLE"},origin);
  const signedUrl=new URL(signed.signedUrl);
  const expectedHost=new URL(url).host;
  if(signedUrl.protocol!=="https:"||signedUrl.host!==expectedHost||
     !signedUrl.pathname.startsWith("/storage/v1/object/sign/"+REPORT_BUCKET+"/"))
   return reportJson(503,{error:"REPORT_LINK_INVALID"},origin);
  return reportJson(200,{ok:true,status:"report_available",
   report_url:signed.signedUrl,report_sha256:hash,byte_size:bytes.byteLength,
   expires_in_seconds:60,delivery_receipt_recorded:false},origin);
 }catch{
  return reportJson(503,{error:"REPORT_VERIFICATION_UNAVAILABLE"},origin);
 }
}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS"){
  if(!FIRST_PARTY.has(origin))return reportJson(403,{error:"ORIGIN_DENIED"},origin);
  return new Response(null,{status:204,headers:{"access-control-allow-origin":origin,
   "access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"content-type",
   "access-control-max-age":"600","vary":"Origin","cache-control":"no-store"}});
 }
 if(req.method==="POST"){
  const stripe=getStripe();
  if(!stripe)return reportJson(503,{error:"STRIPE_CONFIG_MISSING"},origin);
  return guestReport(req,stripe,origin);
 }
 const u=new URL(req.url); const sessionId=u.searchParams.get("session_id");
 if(req.method!=="GET"||!sessionId)return new Response("Missing session_id",{status:400});
 const stripe=getStripe();
 if(!stripe){console.error("marketplace-diagnostic-delivery: STRIPE_CONFIG_MISSING");return Response.json({error:"STRIPE_CONFIG_MISSING",required_any_of:["STRIPE_API_KEY","STRIPE_SECRET_KEY"],retryable:true},{status:503});}
 try{
   const session=await stripe.checkout.sessions.retrieve(sessionId,{expand:["line_items.data.price.product"]});
   if(!SESSION_ID.test(sessionId)||session.id!==sessionId||!canonicalPaid(session))return new Response("Diagnostic payment not verified",{status:409});
   const listingId=String(session.metadata?.marketplace_listing_id||"");
   if(!listingId)return new Response("Not a marketplace order",{status:400});
   const {data:order,error}=await admin.from("marketplace_orders").select("id,buyer_email,payment_status,fulfillment_status,order_state").eq("checkout_session_id",sessionId).eq("listing_id",listingId).single();
   if(error||!order||order.payment_status!=="paid")return new Response("Order settlement not yet visible. Please refresh in a few seconds.",{status:409});
   const esc=(v:string)=>String(v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));
   const state=String(order.fulfillment_status||"pending");
   const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commander Deck Diagnostic</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:20px;background:#0a0b0e;color:#f7f4ee}a,button{color:#0a0b0e;background:#c9a24b;padding:12px 18px;border-radius:8px;text-decoration:none;border:0;font-weight:700;cursor:pointer}code{color:#c9a24b}textarea{width:100%;min-height:320px;background:#12151b;color:#f7f4ee;border:1px solid #3a404b;border-radius:10px;padding:12px;font:14px ui-monospace,monospace;box-sizing:border-box}label{display:block;margin:20px 0 8px;color:#c8cdd5;font-weight:700}.card{background:#11151b;border:1px solid #2c333e;border-radius:14px;padding:18px;margin-top:18px}.muted{color:#a4aab5;font-size:14px}</style></head><body><h1>Commander Deck Diagnostic</h1><p>Payment settled. Order <code>${esc(order.id)}</code> is in the marketplace fulfillment pipeline.</p><div class="card"><p class="muted">Paste your complete Commander decklist below. The system verifies the settled payment before accepting the input.</p><form method="post" action="https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input"><input type="hidden" name="checkout_session_id" value="${esc(sessionId)}"><label for="decklist">Commander decklist</label><textarea id="decklist" name="decklist" minlength="20" maxlength="30000" required placeholder="1 Sol Ring&#10;1 Command Tower&#10;..."></textarea><p><button type="submit">Submit decklist</button></p></form></div><p class="muted">Current fulfillment state: ${esc(state)}. The report is not considered delivered until the marketplace records the verified artifact.</p></body></html>`;
   return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8"}});
 }catch(e){const errorName=e instanceof Error?e.name:"UnknownError";console.error("marketplace-diagnostic-delivery: STRIPE_SESSION_LOOKUP_FAILED",{errorName});return Response.json({error:"STRIPE_SESSION_LOOKUP_FAILED",retryable:true},{status:500})}
});
