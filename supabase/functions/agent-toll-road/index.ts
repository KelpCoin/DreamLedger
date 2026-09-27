import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "npm:hono";
import { paymentMiddleware } from "npm:@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "npm:@x402/core/server";
import { registerExactEvmScheme } from "npm:@x402/evm/exact/server";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAY_TO = Deno.env.get("X402_PAY_TO") || "";
const FACILITATOR_URL = Deno.env.get("X402_FACILITATOR_URL") || "";
const NETWORK = Deno.env.get("X402_NETWORK") || "eip155:8453";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const app = new Hono();

app.get("/healthz", c => c.json({
  ok: true,
  service: "agent-toll-road",
  payment_mode: PAY_TO && FACILITATOR_URL ? "x402" : "DISABLED_UNCONFIGURED",
  network: NETWORK
}));

app.get("/catalog", async c => {
  const { data, error } = await db.from("agent_toll_products")
    .select("product_id,name,price_usd,endpoint,description")
    .eq("active", true)
    .order("product_id");
  if (error) return c.json({ error: "CATALOG_UNAVAILABLE" }, 503);
  return c.json({ service: "DreamLedger Truth Toll Road", products: data });
});

function hashObject(value: unknown) {
  const raw = JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)).then(b =>
    Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("")
  );
}

app.use("*", async (c, next) => {
  if (!PAY_TO || !FACILITATOR_URL) return c.json({
    error: "PAYMENT_RAIL_NOT_CONFIGURED",
    service: "agent-toll-road"
  }, 503);
  return next();
});

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const x402 = new x402ResourceServer(facilitator);
registerExactEvmScheme(x402);

app.use(paymentMiddleware({
  "POST /v1/reconcile": {
    accepts: [{ scheme: "exact", price: "$0.02", network: NETWORK, payTo: PAY_TO }],
    description: "Reconcile a supplied payment/order reference against durable commerce truth.",
    mimeType: "application/json"
  },
  "POST /v1/contradictions": {
    accepts: [{ scheme: "exact", price: "$0.02", network: NETWORK, payTo: PAY_TO }],
    description: "Check supplied economic claims against durable DreamLedger records.",
    mimeType: "application/json"
  },
  "POST /v1/passport": {
    accepts: [{ scheme: "exact", price: "$0.05", network: NETWORK, payTo: PAY_TO }],
    description: "Build a machine-readable evidence passport from durable commerce truth.",
    mimeType: "application/json"
  }
}, x402));

app.post("/v1/reconcile", async c => {
  const body = await c.req.json().catch(() => ({}));
  const { payment_intent_id, checkout_session_id, order_id } = body;
  const { data: orders, error } = await db.from("revenue_orders")
    .select("id,stripe_payment_intent_id,stripe_checkout_session_id,sku_id,amount_nzd,currency,status,paid_at,created_at")
    .or([
      payment_intent_id ? `stripe_payment_intent_id.eq.${payment_intent_id}` : "",
      checkout_session_id ? `stripe_checkout_session_id.eq.${checkout_session_id}` : "",
      order_id ? `id.eq.${order_id}` : ""
    ].filter(Boolean).join(","));
  if (error) return c.json({ error: "TRUTH_QUERY_FAILED" }, 500);
  const { data: attrs } = await db.from("economic_attribution")
    .select("attribution_id,outcome_id,attribution_status,attribution_method,payment_id,fulfillment_id,evidence_reference")
    .or([
      payment_intent_id ? `payment_id.eq.${payment_intent_id}` : "",
      order_id ? `outcome_id.eq.${order_id}` : ""
    ].filter(Boolean).join(","));
  const result = {
    verdict: orders?.length ? "MATCHED_ORDER" : "NO_MATCH",
    revenue_orders: orders || [],
    attribution: attrs || [],
    external_truth_established: Boolean((orders||[]).some((o:any)=>o.status==="paid") && (attrs||[]).some((a:any)=>a.attribution_status==="VERIFIED"))
  };
  const result_hash = await hashObject(result);
  return c.json({ ...result, result_hash });
});

app.post("/v1/contradictions", async c => {
  const body = await c.req.json().catch(() => ({}));
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const contradictions:any[] = [];
  for (const claim of claims) {
    if (!claim || typeof claim !== "object") continue;
    if (claim.revenue_nzd !== undefined) {
      const { data } = await db.from("economic_outcomes").select("amount_nzd,truth_status").eq("truth_status","VERIFIED");
      const observed = (data||[]).reduce((n:any,r:any)=>n+Number(r.amount_nzd||0),0);
      if (Number(claim.revenue_nzd) !== observed) contradictions.push({claim,observed_revenue_nzd:observed,code:"REVENUE_MISMATCH"});
    }
    if (claim.verified_external_revenue === true) {
      const { count } = await db.from("economic_outcomes").select("outcome_id",{count:"exact",head:true}).eq("truth_status","VERIFIED");
      if ((count||0)===0) contradictions.push({claim,observed_verified_outcomes:0,code:"NO_VERIFIED_OUTCOME"});
    }
  }
  const result = { verdict: contradictions.length ? "CONTRADICTED" : "NO_CONTRADICTION_FOUND", contradictions };
  const result_hash = await hashObject(result);
  return c.json({ ...result, result_hash });
});

app.post("/v1/passport", async c => {
  const body = await c.req.json().catch(() => ({}));
  const { order_id, outcome_id } = body;
  const { data: order } = order_id ? await db.from("revenue_orders").select("*").eq("id",order_id).maybeSingle() : {data:null};
  const { data: outcome } = outcome_id ? await db.from("economic_outcomes").select("*").eq("outcome_id",outcome_id).maybeSingle() : {data:null};
  const result = {
    passport_version: "DL-TRUTH-1",
    order,
    outcome,
    claims: {
      payment: Boolean(order?.status==="paid"),
      attribution: false,
      fulfillment: false,
      independent_evidence: false
    },
    verdict: "INCOMPLETE"
  };
  const result_hash = await hashObject(result);
  return c.json({ ...result, result_hash });
});

Deno.serve(app.fetch);
