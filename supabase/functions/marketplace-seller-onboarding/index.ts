import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "https://dreamledger.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function stripePost(path: string, params: URLSearchParams) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || "Stripe request failed");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publicKey || !serviceKey) return json({ error: "server_configuration_incomplete" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);

  const auth = createClient(url, publicKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return json({ error: "authentication_required" }, 401);

  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const displayName = String(body.display_name || user.email?.split("@")[0] || "Seller").trim().slice(0, 120);

  const { data: existing, error: existingError } = await admin
    .from("marketplace_seller_accounts")
    .select("id,seller_id,stripe_connect_account_id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (existingError) return json({ error: existingError.message }, 500);

  let sellerId = existing?.seller_id;
  let accountId = existing?.stripe_connect_account_id;

  if (!sellerId) {
    const { data: seller, error } = await admin.from("marketplace_sellers").insert({
      seller_type: "individual", display_name: displayName, country_code: "NZ", status: "pending"
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);
    sellerId = seller.id;
  }

  if (!accountId) {
    const p = new URLSearchParams();
    p.set("type", "express");
    p.set("country", "NZ");
    if (user.email) p.set("email", user.email);
    p.set("business_type", "individual");
    p.set("capabilities[card_payments][requested]", "true");
    p.set("capabilities[transfers][requested]", "true");
    p.set("metadata[dreamledger_seller_id]", sellerId);
    p.set("metadata[dreamledger_owner_user_id]", user.id);

    const account = await stripePost("accounts", p);
    accountId = account.id;

    const { error } = await admin.from("marketplace_seller_accounts").upsert({
      seller_id: sellerId, owner_user_id: user.id, stripe_connect_account_id: accountId,
      account_type: "express", onboarding_status: "pending",
      details_submitted: Boolean(account.details_submitted),
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      requirements_due: account.requirements?.currently_due || [],
      last_stripe_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "owner_user_id" });
    if (error) return json({ error: error.message }, 500);
  }

  const link = await stripePost("account_links", new URLSearchParams({
    account: accountId,
    refresh_url: "https://dreamledger.org/marketplace/sell/?onboarding=refresh",
    return_url: "https://dreamledger.org/marketplace/sell/?onboarding=complete",
    type: "account_onboarding"
  }));

  return json({ seller_id: sellerId, stripe_connect_account_id: accountId, onboarding_url: link.url });
});