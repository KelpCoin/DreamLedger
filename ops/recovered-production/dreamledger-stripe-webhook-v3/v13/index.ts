import Stripe from "npm:stripe@22";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_API_KEY = (Deno.env.get("STRIPE_API_KEY") ?? "").trim() || (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const stripe = new Stripe(STRIPE_API_KEY, {
  apiVersion: "2025-06-30.basil",
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function db(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init.headers || {}),
    },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_API_KEY || !WEBHOOK_SECRET) {
    return json(503, { error: "Webhook configuration incomplete" });
  }

  const signature = req.headers.get("Stripe-Signature") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return json(400, { error: "Invalid Stripe signature" });
  }

  const eventId = String(event.id);
  const eventType = String(event.type);

  const existing = await db(
    `stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id,processed`,
  );
  if (!existing.ok) return json(503, { error: "Webhook idempotency lookup failed" });
  const existingRows = await existing.json();
  if (Array.isArray(existingRows) && existingRows.length) {
    return json(200, { received: true, duplicate: true, event_id: eventId });
  }

  if (eventType !== "checkout.session.completed") {
    const ignored = await db("stripe_webhook_events", {
      method: "POST",
      body: JSON.stringify({
        event_id: eventId,
        event_type: eventType,
        processed: true,
        processed_at: new Date().toISOString(),
        payload: event,
      }),
    });
    if (!ignored.ok && ignored.status !== 409) {
      return json(500, { error: "Failed to record webhook event" });
    }
    return json(200, { received: true, ignored: eventType, event_id: eventId });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};
  const email = String(session.customer_details?.email ?? session.customer_email ?? "")
    .trim()
    .toLowerCase();

  const observation = {
    stripe_event_id: eventId,
    event_type: eventType,
    checkout_session_id: session.id ?? null,
    payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    sku_id: metadata.dreamledger_sku ?? metadata.product_sku ?? metadata.sku ?? null,
    offer_id: metadata.offer_id ?? null,
    silo_id: metadata.silo ?? null,
    amount_total: Number.isFinite(Number(session.amount_total))
      ? Number(session.amount_total)
      : null,
    currency: session.currency ? String(session.currency).toUpperCase() : null,
    livemode: session.livemode === true,
    payment_status: session.payment_status ? String(session.payment_status) : null,
    session_status: session.status ? String(session.status) : null,
    customer_email_hash: email ? await sha256(email) : null,
    observed_at: new Date().toISOString(),
    raw_payload: event,
  };

  const obs = await db("stripe_webhook_observations", {
    method: "POST",
    body: JSON.stringify(observation),
  });
  if (!obs.ok && obs.status !== 409) {
    return json(500, {
      error: "Failed to record Stripe webhook observation",
      status: obs.status,
    });
  }

  const paid = session.livemode === true && session.payment_status === "paid";
  const economicState = paid ? "PAYMENT_SETTLED" : "CHECKOUT_COMPLETED";

  const lookup = await db(
    `cube_observations?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=observation_id&order=observed_at.desc&limit=1`,
  );
  if (!lookup.ok) return json(503, { error: "CUBE observation lookup failed" });

  const matches = await lookup.json();
  if (Array.isArray(matches) && matches.length) {
    const observationId = matches[0].observation_id;
    const patch = await db(`cube_observations?observation_id=eq.${encodeURIComponent(observationId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        stripe_event_id: eventId,
        stripe_session_id: session.id,
        economic_state: economicState,
        offer_id: metadata.offer_id ?? null,
        sku_id: metadata.dreamledger_sku ?? metadata.product_sku ?? metadata.sku ?? null,
        evidence: {
          stripe_event_id: eventId,
          stripe_livemode: session.livemode === true,
          payment_status: session.payment_status ?? null,
          payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          reconciled_at: new Date().toISOString(),
        },
      }),
    });
    if (!patch.ok) return json(500, { error: "Failed to reconcile CUBE observation" });
  } else {
    const synthetic = await db("cube_observations", {
      method: "POST",
      body: JSON.stringify({
        observed_at: new Date().toISOString(),
        source_ip: null,
        source_ip_hash: null,
        user_agent: "stripe-webhook",
        request_method: "POST",
        request_path: "/stripe-webhook/checkout.session.completed",
        http_status: 200,
        redirect_target: null,
        stripe_session_id: session.id,
        stripe_event_id: eventId,
        offer_id: metadata.offer_id ?? null,
        sku_id: metadata.dreamledger_sku ?? metadata.product_sku ?? metadata.sku ?? null,
        economic_state: economicState,
        observation_source: "stripe_webhook_reconciliation",
        evidence: {
          stripe_livemode: session.livemode === true,
          payment_status: session.payment_status ?? null,
          payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          reconciled_at: new Date().toISOString(),
          note: "No preceding application-owned HTTP observation matched this Stripe session.",
        },
      }),
    });
    if (!synthetic.ok && synthetic.status !== 409) {
      return json(500, { error: "Failed to create CUBE reconciliation observation" });
    }
  }

  const receipt = await db("stripe_webhook_events", {
    method: "POST",
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      processed: true,
      processed_at: new Date().toISOString(),
      payload: event,
    }),
  });
  if (!receipt.ok && receipt.status !== 409) {
    return json(500, { error: "Failed to record webhook receipt", status: receipt.status });
  }

  return json(200, {
    received: true,
    observed: true,
    reconciled: true,
    economic_state: economicState,
    event_id: eventId,
    checkout_session_id: session.id,
  });
});
