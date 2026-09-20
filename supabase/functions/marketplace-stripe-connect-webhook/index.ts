import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://dreamledger.org",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const signature = req.headers.get("stripe-signature");

  if (!secret || !stripeKey || !supabaseUrl || !serviceKey) {
    return json({ error: "server_configuration_incomplete" }, 500);
  }
  if (!signature) return json({ error: "missing_stripe_signature" }, 400);

  const raw = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-06-30.basil" });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch {
    return json({ error: "invalid_stripe_signature" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const account = event.account || null;
  const object = event.data.object as Stripe.Account;

  if (!account || !object?.id || object.id !== account) {
    return json({ received: true, ignored: "not_connected_account_event" });
  }

  if (event.type === "account.updated") {
    const metadata = object.metadata || {};
    const sellerId = metadata.dreamledger_seller_id;
    const ownerUserId = metadata.dreamledger_owner_user_id;

    let sellerAccountQuery = admin
      .from("marketplace_seller_accounts")
      .update({
        details_submitted: !!object.details_submitted,
        charges_enabled: !!object.charges_enabled,
        payouts_enabled: !!object.payouts_enabled,
        onboarding_status: object.payouts_enabled
          ? "complete"
          : (object.details_submitted ? "pending" : "not_started"),
        requirements_due: object.requirements?.currently_due || [],
        last_stripe_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("stripe_connect_account_id", account);

    if (sellerId) sellerAccountQuery = sellerAccountQuery.eq("seller_id", sellerId);
    else if (ownerUserId) sellerAccountQuery = sellerAccountQuery.eq("owner_user_id", ownerUserId);

    const { error: accountError } = await sellerAccountQuery;
    if (accountError) return json({ error: accountError.message }, 500);

    if (sellerId) {
      const { error: sellerError } = await admin
        .from("marketplace_sellers")
        .update({
          status: object.payouts_enabled ? "active" : "pending",
          stripe_connect_account_id: account
        })
        .eq("id", sellerId);
      if (sellerError) return json({ error: sellerError.message }, 500);
    }
  }

  if (event.type === "transfer.created" || event.type === "transfer.updated" || event.type === "transfer.reversed") {
    const transfer = event.data.object as Stripe.Transfer;
    const { error } = await admin.from("marketplace_transfers").update({
      status: transfer.reversed ? "reversed" : (transfer.status || "pending"),
      stripe_transfer_id: transfer.id,
      updated_at: new Date().toISOString()
    }).eq("stripe_transfer_id", transfer.id);
    if (error) return json({ error: error.message }, 500);
  }

  if (event.type === "payout.paid" || event.type === "payout.failed") {
    // Payout state is retained as Stripe event evidence. Seller account readiness
    // remains governed by account.updated.payouts_enabled.
  }

  return json({ received: true, event_id: event.id, event_type: event.type });
});
