import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^22";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || Deno.env.get("STRIPE_SECRET_KEY") || "");
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return Response.json({ service: "stripe-revenue-41104f355d6878cdd6d1f9dc", status: "healthy" });
  }
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!STRIPE_WEBHOOK_SECRET) return new Response("webhook authentication unavailable", { status: 503 });
  const signature = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (error) {
    console.error("Stripe signature verification failed", error instanceof Error ? error.message : "unknown error");
    return new Response("invalid signature", { status: 400 });
  }
  console.log(`Event received: ${event.id}`);
  if (event.type !== "checkout.session.completed") return Response.json({ received: true, ignored: true });

  const session = event.data.object as Stripe.Checkout.Session;
  const sku = session.metadata?.sku_id;
  if (!sku) return new Response("missing sku_id", { status: 400 });

  const { data: catalog, error: catalogError } = await supabase.from("revenue_catalog").select("sku_id,price_nzd").eq("sku_id", sku).eq("active", true).limit(1);
  if (catalogError) return new Response("catalog lookup failed", { status: 500 });
  if (!catalog?.length) return new Response("unknown sku", { status: 400 });

  const amountMinor = Number(session.amount_total || 0);
  const currency = String(session.currency || "nzd").toLowerCase();
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const paidAt = new Date().toISOString();
  let orderId: string | null = null;
  let newlyInsertedOrder = false;

  const { data: order, error: orderError } = await supabase.from("revenue_orders").insert({
    stripe_event_id: event.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
    sku_id: sku,
    amount_nzd: Math.round(amountMinor / 100),
    currency,
    customer_email: session.customer_details?.email || session.customer_email || null,
    status: "paid",
    paid_at: paidAt,
    raw_event: event,
  }).select("id").maybeSingle();

  if (orderError) {
    const { data: existingOrder } = await supabase.from("revenue_orders").select("id").eq("stripe_event_id", event.id).limit(1).maybeSingle();
    if (!existingOrder) return new Response("order creation failed", { status: 500 });
    orderId = existingOrder.id;
  } else if (order) {
    orderId = order.id;
    newlyInsertedOrder = true;
  }
  if (!orderId) return new Response("order creation failed", { status: 500 });

  const { error: ledgerError } = await supabase.from("event_ledger").insert({
    idempotency_key: event.id,
    stripe_event_id: event.id,
    type: "payment.verified",
    amount_minor: amountMinor,
    currency,
    sku_id: sku,
    raw: event,
  });
  if (ledgerError) {
    const { data: existingLedger } = await supabase.from("event_ledger").select("id").eq("idempotency_key", event.id).limit(1).maybeSingle();
    if (!existingLedger) return new Response("ledger write failed", { status: 500 });
  }

  const { data: entitlement } = await supabase.from("revenue_entitlements").select("id,fulfillment_key").eq("order_id", orderId).limit(1).maybeSingle();
  let fulfillmentKey = entitlement?.fulfillment_key || null;
  if (!entitlement) {
    fulfillmentKey = `DL-${sku}-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
    const { error: entitlementError } = await supabase.from("revenue_entitlements").insert({ order_id: orderId, sku_id: sku, fulfillment_key: fulfillmentKey, status: "ready" });
    if (entitlementError) {
      const { data: retryEntitlement } = await supabase.from("revenue_entitlements").select("fulfillment_key").eq("order_id", orderId).limit(1).maybeSingle();
      if (!retryEntitlement) return new Response("entitlement creation failed", { status: 500 });
      fulfillmentKey = retryEntitlement.fulfillment_key;
    }
  }

  const { error: fossilError } = await supabase.from("revenue_fossils").insert({
    fossil_type: "receipt.json",
    payment_id: paymentIntentId || session.id,
    stripe_event_id: event.id,
    sku_id: sku,
    amount_minor: amountMinor,
    currency,
    verified_at: paidAt,
    payload: { order_id: orderId, checkout_session_id: session.id, payment_intent_id: paymentIntentId, fulfillment_key: fulfillmentKey, source: "stripe.checkout.session.completed" },
  });
  if (fossilError) {
    const { data: existingFossil } = await supabase.from("revenue_fossils").select("id").eq("stripe_event_id", event.id).limit(1).maybeSingle();
    if (!existingFossil) return new Response("fossil write failed", { status: 500 });
  }

  return Response.json({ received: true, verified: true, order_id: orderId, sku_id: sku, fulfillment_key: fulfillmentKey, idempotent: !newlyInsertedOrder });
});
