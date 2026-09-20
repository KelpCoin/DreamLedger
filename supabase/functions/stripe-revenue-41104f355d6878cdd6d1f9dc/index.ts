import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createMarketplaceSellerTransfers } from "../_shared/marketplace-transfers.ts";
const FUNCTION_NAME="stripe-revenue-41104f355d6878cdd6d1f9dc";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const STRIPE_WEBHOOK_SIGNING_SECRET=Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")||"";
const STRIPE_API_KEY=Deno.env.get("STRIPE_API_KEY")||Deno.env.get("STRIPE_SECRET_KEY")||"";
const supabase=SUPABASE_URL&&SERVICE_ROLE_KEY?createClient(SUPABASE_URL,SERVICE_ROLE_KEY):null;
Deno.serve(async(req)=>{
 if(req.method==="GET")return Response.json({service:FUNCTION_NAME,status:"healthy",configured:Boolean(SUPABASE_URL&&SERVICE_ROLE_KEY&&STRIPE_API_KEY&&STRIPE_WEBHOOK_SIGNING_SECRET)});
 if(req.method!=="POST")return new Response("POST only",{status:405});
 if(!SUPABASE_URL||!SERVICE_ROLE_KEY||!STRIPE_API_KEY||!STRIPE_WEBHOOK_SIGNING_SECRET||!supabase)return new Response("webhook authentication unavailable",{status:503});
 const {default:Stripe}=await import("npm:stripe@22"); const stripe=new Stripe(STRIPE_API_KEY); const cryptoProvider=Stripe.createSubtleCryptoProvider();
 const signature=req.headers.get("stripe-signature")||""; const raw=await req.text(); let event:any;
 try{event=await stripe.webhooks.constructEventAsync(raw,signature,STRIPE_WEBHOOK_SIGNING_SECRET,undefined,cryptoProvider)}catch(error){return new Response("invalid signature",{status:400})}
 const eventId=String(event.id||""); const eventType=String(event.type||""); if(!eventId)return new Response("missing event id",{status:400});
 const {data:existingWebhook}=await supabase.from("stripe_webhook_events").select("event_id,processed").eq("event_id",eventId).maybeSingle();
 if(existingWebhook?.processed===true)return Response.json({received:true,duplicate:true,event_id:eventId});
 const {error:webhookInsertError}=await supabase.from("stripe_webhook_events").upsert({event_id:eventId,event_type:eventType,processed:false,processed_at:null,payload:event},{onConflict:"event_id"}); if(webhookInsertError)return new Response("webhook event persistence failed",{status:500});
 if(eventType!=="checkout.session.completed"){await supabase.from("stripe_webhook_events").update({processed:true,processed_at:new Date().toISOString()}).eq("event_id",eventId);return Response.json({received:true,ignored:true,event_id:eventId});}
 const session=event.data?.object||{}; const metadata=session.metadata||{}; const amountMinor=Number(session.amount_total||0); const currency=String(session.currency||"").toUpperCase(); const paymentIntentId=typeof session.payment_intent==="string"?session.payment_intent:null; const checkoutSessionId=String(session.id||""); const customerEmail=session.customer_details?.email||session.customer_email||null;
 if(!checkoutSessionId||session.payment_status!=="paid")return new Response("checkout session is not paid",{status:400}); if(currency!=="NZD")return new Response("unexpected currency",{status:400});
 const marketplaceListingId=String(metadata.marketplace_listing_id||"");
 let marketplaceSettlement:any=null;
 let marketplaceListing:any=null;
 let sku=String(metadata.sku_id||metadata.sku||"");
 if(marketplaceListingId){
   const {data:listing,error:listingError}=await supabase.from("marketplace_listings").select("id,sku,title,price_nzd,status,inventory,seller_id,organization_id,fulfillment_type,metadata").eq("id",marketplaceListingId).single();
   if(listingError||!listing)return new Response("marketplace listing not found",{status:400});
   marketplaceListing=listing;
   const {data:settlement,error:settlementError}=await supabase.rpc("marketplace_settle_stripe_payment",{p_listing_id:marketplaceListingId,p_checkout_session_id:checkoutSessionId,p_payment_intent_id:paymentIntentId,p_event_id:eventId,p_amount_nzd:amountMinor/100,p_currency:currency,p_customer_email:customerEmail,p_quantity:1});
   if(settlementError)return new Response("marketplace settlement failed",{status:500});
   marketplaceSettlement=settlement;
   sku=listing.sku==="COMMANDER-DECK-DIAGNOSTIC-001" ? "CMD-DIAG-29" : String(listing.sku||"");
   const marketplaceOrderId=String(marketplaceSettlement?.order_id||"");
   if(marketplaceOrderId){
     const transferGroup=`order_${marketplaceOrderId}`;
     await supabase.from("marketplace_orders").update({stripe_transfer_group:transferGroup}).eq("id",marketplaceOrderId);
     let stripeChargeId:string|null=null;
     if(paymentIntentId){
       const paymentIntent:any=await stripe.paymentIntents.retrieve(paymentIntentId,{expand:["latest_charge"]});
       stripeChargeId=typeof paymentIntent.latest_charge==="string" ? paymentIntent.latest_charge : (paymentIntent.latest_charge?.id||null);
       await supabase.from("marketplace_payments").update({stripe_charge_id:stripeChargeId}).eq("order_id",marketplaceOrderId);
     }
     const transferLedger=await createMarketplaceSellerTransfers({
       stripe,
       supabase,
       orderId:marketplaceOrderId,
       stripeChargeId,
       transferGroup
     });
     marketplaceSettlement={...marketplaceSettlement,transfer_ledger:transferLedger};
   }
 }
 if(!sku)return new Response("missing sku_id",{status:400});
 const {data:catalog,error:catalogError}=await supabase.from("revenue_catalog").select("sku_id,price_nzd,active,fulfillment_type").eq("sku_id",sku).eq("active",true).limit(1).maybeSingle(); if(catalogError)return new Response("catalog lookup failed",{status:500}); if(!catalog)return new Response("unknown or inactive sku",{status:400});
 const amountNzd=amountMinor/100; if(Number(catalog.price_nzd)!==amountNzd)return new Response("amount does not match catalog price",{status:400});
 const {data:skuRow,error:skuError}=await supabase.from("skus").select("id,silo_id,status").eq("id",sku).limit(1).maybeSingle(); if(skuError)return new Response("sku lookup failed",{status:500}); if(!skuRow||skuRow.status!=="active")return new Response("sku is not present in authoritative sku registry",{status:400});
 const paidAt=session.created?new Date(Number(session.created)*1000).toISOString():new Date().toISOString(); let orderId:string|null=null;
 const {data:existingOrder}=await supabase.from("revenue_orders").select("id").eq("stripe_event_id",eventId).limit(1).maybeSingle(); if(existingOrder?.id)orderId=existingOrder.id; else {const {data:order,error:orderError}=await supabase.from("revenue_orders").insert({stripe_event_id:eventId,stripe_checkout_session_id:checkoutSessionId,stripe_payment_intent_id:paymentIntentId,stripe_customer_id:typeof session.customer==="string"?session.customer:null,sku_id:sku,amount_nzd:Math.round(amountNzd),currency:currency.toLowerCase(),customer_email:customerEmail,status:"paid",paid_at:paidAt,raw_event:event}).select("id").single(); if(orderError||!order)return new Response("order creation failed",{status:500}); orderId=order.id;}
 const {error:ledgerInsertError}=await supabase.from("event_ledger").upsert({idempotency_key:eventId,stripe_event_id:eventId,type:"payment.observed",amount_minor:amountMinor,currency:currency.toLowerCase(),sku_id:sku,raw:event},{onConflict:"idempotency_key"}); if(ledgerInsertError)return new Response("ledger write failed",{status:500});
 let entitlement:any=null; const {data:existingEntitlement}=await supabase.from("revenue_entitlements").select("id,fulfillment_key,status").eq("order_id",orderId).limit(1).maybeSingle(); if(existingEntitlement)entitlement=existingEntitlement; else {const fulfillmentKey=`DL-${sku}-${crypto.randomUUID().replaceAll("-","").slice(0,20).toUpperCase()}`; const {data:createdEntitlement,error:entitlementError}=await supabase.from("revenue_entitlements").insert({order_id:orderId,sku_id:sku,fulfillment_key:fulfillmentKey,status:"ready"}).select("id,fulfillment_key,status").single(); if(entitlementError||!createdEntitlement)return new Response("entitlement creation failed",{status:500}); entitlement=createdEntitlement;}
 let fulfillment:any=null; const {data:existingFulfillment,error:fulfillmentLookupError}=await supabase.from("fulfillment_requests").select("id,status").eq("entitlement_id",entitlement.id).limit(1).maybeSingle(); if(fulfillmentLookupError)return new Response("fulfillment lookup failed",{status:500}); if(existingFulfillment)fulfillment=existingFulfillment; else {const {data:createdFulfillment,error:fulfillmentError}=await supabase.from("fulfillment_requests").insert({entitlement_id:entitlement.id,sku_id:sku,customer_email:customerEmail,payload:{source:"stripe_revenue_webhook",stripe_event_id:eventId,stripe_checkout_session_id:checkoutSessionId,stripe_payment_intent_id:paymentIntentId,offer_id:metadata.offer_id?String(metadata.offer_id):null,fulfillment_type:catalog.fulfillment_type||null},status:"queued"}).select("id,status").single(); if(fulfillmentError||!createdFulfillment)return new Response("fulfillment request creation failed",{status:500}); fulfillment=createdFulfillment;}
 const economicEvent={event_id:eventId,opportunity_id:null,event_pattern_id:"STRIPE_CHECKOUT_SESSION_COMPLETED",silo_id:skuRow.silo_id,sku_id:sku,offer_id:metadata.offer_id?String(metadata.offer_id):null,buyer_action_verified:true,payment_settled:true,fulfilment_verified:false,evidence_verified:false,amount_nzd:amountNzd,stripe_checkout_session:checkoutSessionId,stripe_payment_intent:paymentIntentId,evidence_ref:`stripe:event:${eventId}`}; const {error:economicEventError}=await supabase.from("economic_events").upsert(economicEvent,{onConflict:"event_id"}); if(economicEventError)return new Response("economic event write failed",{status:500});
 const {data:reconciliation}=await supabase.from("control_reconciliations").select("reconciliation_id").eq("stripe_event_id",eventId).limit(1).maybeSingle(); if(!reconciliation){const {error:reconciliationError}=await supabase.from("control_reconciliations").insert({payment_reference:paymentIntentId||checkoutSessionId,stripe_event_id:eventId,stripe_payment_intent_id:paymentIntentId,order_reference:orderId,ledger_reference:eventId,payment_amount_nzd:amountNzd,order_amount_nzd:amountNzd,ledger_amount_nzd:amountNzd,payment_exists:true,order_exists:true,ledger_exists:true,amounts_match:true,fulfillment_verified:false,checked_at:new Date().toISOString(),checked_by:FUNCTION_NAME,notes:"Stripe event observed and attributed. Reconciliation remains pending until fulfillment evidence is verified."}); if(reconciliationError)return new Response("control reconciliation write failed",{status:500});}
 const {error:webhookUpdateError}=await supabase.from("stripe_webhook_events").update({processed:true,processed_at:new Date().toISOString()}).eq("event_id",eventId); if(webhookUpdateError)return new Response("webhook finalization failed",{status:500}); return Response.json({received:true,recorded:true,event_id:eventId,sku_id:sku,order_id:orderId,entitlement_id:entitlement.id,fulfillment_request_id:fulfillment.id,marketplace:!!marketplaceListingId,marketplace_settlement:marketplaceSettlement,ra000001_promoted:false});
});
