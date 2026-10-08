import Stripe from "npm:stripe@^22";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("STRIPE_API_KEY") || "";
const publicBase = (Deno.env.get("PUBLIC_BASE_URL") || "https://dreamledger.org").replace(/\/$/, "");

const COSMETICS: Record<string, { name: string; amount: number; currency: string }> = {
  "dreammeez-founder-cloak": { name: "DreamMeez Founder Cloak", amount: 500, currency: "nzd" },
};

const supabase = createClient(supabaseUrl, serviceRoleKey);
const stripe = new Stripe(stripeSecret, { apiVersion: "2025-06-30.basil" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  if (!supabaseUrl || !serviceRoleKey || !stripeSecret) {
    return json({ error: "checkout service not configured" }, 503);
  }

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "authorization required" }, 401);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "invalid session" }, 401);

  const body = await req.json().catch(() => ({}));
  const cosmeticId = String(body.cosmetic_id || "");
  const cosmetic = COSMETICS[cosmeticId];
  if (!cosmetic) return json({ error: "unknown cosmetic" }, 400);

  const { data: owned } = await supabase
    .from("cosmetic_sales")
    .select("cosmetic_id")
    .eq("account_id", authData.user.id)
    .eq("cosmetic_id", cosmeticId)
    .maybeSingle();
  if (owned) return json({ error: "cosmetic already owned" }, 409);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: publicBase + "/avatar.html?purchase=success&cosmetic_id=" + encodeURIComponent(cosmeticId),
    cancel_url: publicBase + "/avatar.html?purchase=cancelled",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: cosmetic.currency,
        unit_amount: cosmetic.amount,
        product_data: { name: cosmetic.name },
      },
    }],
    metadata: {
      dreammeez_cosmetic_id: cosmeticId,
      account_id: authData.user.id,
    },
    payment_intent_data: {
      metadata: {
        dreammeez_cosmetic_id: cosmeticId,
        account_id: authData.user.id,
      },
    },
  });

  return json({ ok: true, cosmetic_id: cosmeticId, checkout_url: session.url });
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://dreamledger.org",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
