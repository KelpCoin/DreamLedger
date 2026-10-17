import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";
import { COMMERCE_SKU_CONTRACT, normalizeCanonicalSku, resolveCanonicalSku } from "../_shared/commerce-sku-contract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_API_KEY = (Deno.env.get("STRIPE_API_KEY") || Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const stripe = STRIPE_API_KEY ? new Stripe(STRIPE_API_KEY) : null;

const COMMANDER_OFFER_ID = "CMD-DIAG-29";
const COMMANDER_CANONICAL_SKU = COMMERCE_SKU_CONTRACT.offer_mappings[COMMANDER_OFFER_ID];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_API_KEY || !stripe) {
    return Response.json({ error: "diagnostic intake configuration incomplete" }, { status: 503 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await req.json()
      : Object.fromEntries(new URLSearchParams(await req.text()).entries());

    const sessionId = String(body.checkout_session_id || body.session_id || "").trim();
    const decklist = String(body.decklist || "");
    if (!sessionId || decklist.length < 20 || decklist.length > 30000) {
      return Response.json({ error: "invalid input" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.livemode !== true || session.payment_status !== "paid") {
      return Response.json({ error: "live payment not settled" }, { status: 409 });
    }

    const email = String(session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    const metadata = session.metadata || {};
    const listingId = String(metadata.marketplace_listing_id || "").trim();
    const resolution = resolveCanonicalSku(metadata);
    let internalSku = resolution && resolution.key !== "marketplace_listing_id" ? resolution.value : "";

    if (!listingId) {
      return Response.json({ error: "not a recognised Commander Diagnostic checkout", reason: "SKU_CONTRACT_VIOLATION" }, { status: 400 });
    }
    const { data: listing, error: listingError } = await db
      .from("marketplace_listings")
      .select("id,sku")
      .eq("id", listingId)
      .maybeSingle();
    if (listingError) return Response.json({ error: "marketplace listing lookup failed" }, { status: 500 });
    if (!listing) return Response.json({ error: "marketplace listing not found" }, { status: 400 });
    const listingSku = normalizeCanonicalSku(listing.sku);
    if (internalSku && internalSku !== listingSku) {
      return Response.json({ error: "metadata SKU does not match canonical listing SKU", reason: "SKU_CONTRACT_VIOLATION" }, { status: 400 });
    }
    internalSku = internalSku || listingSku;
    if (!resolution || internalSku !== COMMANDER_CANONICAL_SKU) {
      return Response.json({ error: "not a recognised Commander Diagnostic checkout", reason: "SKU_CONTRACT_VIOLATION" }, { status: 400 });
    }

    const { data: fulfillment, error: lookupError } = await db
      .from("marketplace_fulfillments")
      .select("fulfillment_id,status")
      .eq("metadata->>stripe_checkout_session_id", sessionId)
      .eq("metadata->>sku", internalSku)
      .maybeSingle();

    if (lookupError) {
      return Response.json({ error: "fulfillment lookup failed" }, { status: 500 });
    }
    if (!fulfillment) {
      return Response.json({
        error: "fulfillment not found yet; canonical settlement may still be processing",
      }, { status: 409 });
    }

    const { error } = await db.rpc("marketplace_submit_diagnostic_input", {
      p_fulfillment_id: fulfillment.fulfillment_id,
      p_customer_email: email,
      p_decklist: decklist,
    });
    if (error) return Response.json({ error: error.message }, { status: 409 });

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      return new Response(
        "<h1>Decklist received</h1><p>Your diagnostic is queued for analysis. You can refresh the checkout delivery page for status.</p>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    return Response.json({ ok: true, fulfillment_id: fulfillment.fulfillment_id, status: "queued" });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
