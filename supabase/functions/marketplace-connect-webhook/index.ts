import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const data = timestamp + "." + payload;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((candidate) => candidate.length === expected.length && [...candidate].every((c, i) => c === expected[i]));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !serviceKey) return json({ error: "server_configuration_incomplete" }, 500);

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  if (!(await verifyStripeSignature(payload, signature, secret))) return json({ error: "invalid_signature" }, 400);

  const event = JSON.parse(payload);
  const admin = createClient(url, serviceKey);
  const accountId = req.headers.get("stripe-account") || event.account || null;
  const type = String(event.type || "");
  const object = event.data?.object || {};

  if (type === "account.updated") {
    const stripeAccountId = object.id || accountId;
    if (!stripeAccountId) return json({ error: "missing_account_id" }, 400);
    const onboardingStatus = object.payouts_enabled && object.charges_enabled ? "complete" : object.details_submitted ? "pending" : "not_started";
    const { error } = await admin.from("marketplace_seller_accounts").update({
      onboarding_status: onboardingStatus,
      details_submitted: Boolean(object.details_submitted),
      charges_enabled: Boolean(object.charges_enabled),
      payouts_enabled: Boolean(object.payouts_enabled),
      requirements_due: object.requirements?.currently_due || [],
      last_stripe_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("stripe_connect_account_id", stripeAccountId);
    if (error) return json({ error: error.message }, 500);
    await admin.from("marketplace_sellers").update({
      stripe_connect_account_id: stripeAccountId,
      status: onboardingStatus === "complete" ? "active" : "pending",
    }).eq("stripe_connect_account_id", stripeAccountId);
    return json({ received: true, type, stripe_account_id: stripeAccountId, onboarding_status: onboardingStatus });
  }

  if (["transfer.created", "transfer.updated", "transfer.reversed"].includes(type)) {
    const transferId = object.id;
    if (transferId) {
      const status = type === "transfer.reversed" ? "reversed" : object.reversed ? "reversed" : object.paid ? "paid" : object.status === "failed" ? "failed" : "created";
      const { error } = await admin.from("marketplace_transfers").update({
        status,
        updated_at: new Date().toISOString(),
        failure_code: object.failure_code || null,
        failure_message: object.failure_message || null,
      }).eq("stripe_transfer_id", transferId);
      if (error) return json({ error: error.message }, 500);
    }
    return json({ received: true, type, stripe_account_id: accountId });
  }

  if (type === "payout.paid" || type === "payout.failed") {
    await admin.from("dreamledger_telemetry_events").insert({
      event_type: type,
      entity_type: "stripe_payout",
      entity_id: object.id || null,
      classification: "OBSERVED",
      source: "stripe-connect-webhook",
      occurred_at: new Date().toISOString(),
      payload: { stripe_account_id: accountId, payout_status: object.status || null, amount: object.amount || null, currency: object.currency || null },
    });
    return json({ received: true, type, stripe_account_id: accountId });
  }

  return json({ received: true, ignored: true, type });
});