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
const QUOTE_ENABLED = Deno.env.get("X402_QUOTE_ENABLED") === "true";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const app = new Hono();

app.get("/healthz", c => c.json({
  ok: true,
  service: "agent-toll-road",
  payment_mode: PAY_TO && FACILITATOR_URL ? "x402" : "DISABLED_UNCONFIGURED",
  quote_compare_mode: QUOTE_ENABLED && PAY_TO && FACILITATOR_URL ? "ENABLED" : "DISABLED",
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

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return "{" + Object.keys(obj).sort().map(k => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

async function hashObject(value: unknown) {
  const raw = canonical(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
}

function clean(s: string) {
  return s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function field(t: string, patterns: RegExp[]) {
  for (const p of patterns) {
    const m = t.match(p);
    if (m) return clean(m[1]);
  }
  return null;
}

function money(s: string) {
  const m = s.replace(/,/g, "").match(/(?:NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)\s*(\d+(?:\.\d{1,2})?)/i);
  return m ? Number(m[1]) : null;
}

function parseQuote(doc: any, index: number) {
  const content = clean(String(doc?.content || ""));
  const source_id = String(doc?.source_id || `quote-${index + 1}`);
  const source_hash = crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return { content, source_id, source_type: String(doc?.type || "text"), source_hash };
}

async function normalizeQuote(doc: any, index: number) {
  const q = await parseQuote(doc, index);
  const supplier = field(q.content, [
    /(?:supplier|vendor|seller|company)\s*[:\-]\s*([^\n]{2,120})/i,
    /^\s*([^\n]{2,100})\s+(?:quotation|quote|proposal)/im
  ]);
  const totalText = field(q.content, [
    /(?:grand total|total(?: price| amount| cost)?|quote total)\s*[:\-]?\s*((?:NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?)/i,
    /(?:price|amount)\s*[:\-]?\s*((?:NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?)/i
  ]);
  const moq = field(q.content, [/(?:MOQ|min(?:imum)? order quantity|min(?:imum)? order)\s*[:\-]?\s*([^\n]{1,80})/i]);
  const lead_time = field(q.content, [/(?:lead time|delivery time|turnaround)\s*[:\-]?\s*([^\n]{1,100})/i]);
  const payment_terms = field(q.content, [/(?:payment terms|terms of payment|payment)\s*[:\-]?\s*([^\n]{1,120})/i]);
  const currencies = [...q.content.matchAll(/\b(NZD|USD|AUD|CAD|EUR|GBP)\b|([$€£])/gi)].map(m => m[1] || m[2]);
  const uniqueCurrency = [...new Set(currencies.map(x => x === "$" ? "SYMBOL_$" : x))];
  const digest = await q.source_hash;
  return {
    source_id: q.source_id,
    source_type: q.source_type,
    source_hash: Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join(""),
    supplier,
    total: totalText ? money(totalText) : null,
    moq,
    lead_time,
    payment_terms,
    currency_signals: uniqueCurrency,
    extraction_status: q.content ? "PARSED" : "EMPTY",
    text_length: q.content.length
  };
}

function compareQuotes(rows: any[]) {
  const exceptions: any[] = [];
  const totals = rows.filter(r => typeof r.total === "number").map(r => r.total);
  const currencies = [...new Set(rows.flatMap(r => r.currency_signals || []))];
  const lowest = totals.length ? Math.min(...totals) : null;
  const highest = totals.length ? Math.max(...totals) : null;
  const spread = lowest !== null && highest !== null ? Number((highest - lowest).toFixed(2)) : null;
  if (rows.length < 2 || totals.length < 2) exceptions.push({ type: "INSUFFICIENT_TOTALS", severity: "HIGH" });
  if (currencies.length > 1) exceptions.push({ type: "MIXED_CURRENCY_SIGNALS", severity: "HIGH", values: currencies });
  for (const fieldName of ["supplier", "total", "moq", "lead_time", "payment_terms"]) {
    const missing = rows.filter(r => r[fieldName] === null || r[fieldName] === "").map(r => r.source_id);
    if (missing.length) exceptions.push({ type: "MISSING_FIELD", field: fieldName, severity: "MEDIUM", sources: missing });
  }
  const evidence_verdict =
    exceptions.some(e => e.type === "INSUFFICIENT_TOTALS") ? "INSUFFICIENT_EVIDENCE" :
    exceptions.some(e => e.severity === "HIGH") ? "MISMATCH" :
    exceptions.some(e => e.severity === "MEDIUM") ? "UNRESOLVED" : "MATCH";
  const action_policy =
    evidence_verdict === "INSUFFICIENT_EVIDENCE" ? "BLOCK" :
    evidence_verdict === "MISMATCH" ? "STEP_UP" :
    evidence_verdict === "UNRESOLVED" ? "REVIEW" : "ALLOW";
  return {
    quote_count: rows.length,
    totals_observed: totals.length,
    lowest_total: lowest,
    highest_total: highest,
    total_spread: spread,
    exceptions,
    evidence_verdict,
    action_policy,
    evidence_status: evidence_verdict === "MATCH" || evidence_verdict === "MISMATCH" ? "SUFFICIENT" : "PARTIAL"
  };
}

async function recordCall(body: any, result: any, settlement_status: string) {
  const request_hash = await hashObject(body);
  const result_hash = await hashObject(result);
  await db.from("agent_toll_calls").insert({
    product_id: "truth.quote_compare",
    payer: "",
    payment_tx: null,
    payment_network: NETWORK,
    payment_amount_usd: 0.50,
    settlement_status,
    request_hash,
    result_hash,
    result
  });
  return { request_hash, result_hash };
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
  },
  "POST /v1/compare_quotes": {
    accepts: [{ scheme: "exact", price: "$0.50", network: NETWORK, payTo: PAY_TO }],
    description: "Compare 2-5 supplier quotes using deterministic extraction, normalization and evidence checks.",
    mimeType: "application/json"
  }
}, x402));

app.post("/v1/compare_quotes", async c => {
  if (!QUOTE_ENABLED) return c.json({ error: "QUOTE_COMPARE_DISABLED" }, 503);
  const body = await c.req.json().catch(() => ({}));
  const documents = Array.isArray(body.documents) ? body.documents : [];
  if (documents.length < 2 || documents.length > 5) return c.json({ error: "DOCUMENT_COUNT_MUST_BE_2_TO_5" }, 400);
  const rows = [];
  for (let i = 0; i < documents.length; i++) rows.push(await normalizeQuote(documents[i], i));
  const comparison = compareQuotes(rows);
  const packet = {
    protocol: "DL-QUOTE-COMPARE-1",
    engine_version: "1.0.0",
    inputs: rows.map(r => ({ source_id: r.source_id, source_hash: r.source_hash })),
    comparison,
    generated_at: new Date().toISOString()
  };
  const packet_hash = await hashObject(packet);
  const result = {
    decision_type: "QUOTE_COMPARABILITY",
    evidence_verdict: comparison.evidence_verdict,
    action_policy: comparison.action_policy,
    evidence_status: comparison.evidence_status,
    comparison,
    evidence_packet_hash: packet_hash
  };
  await recordCall(body, result, "VERIFIED_FOR_FULFILLMENT_PENDING_SETTLEMENT");
  return c.json(result);
});

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
    external_truth_established: Boolean((orders || []).some((o:any) => o.status === "paid") && (attrs || []).some((a:any) => a.attribution_status === "VERIFIED"))
  };
  const result_hash = await hashObject(result);
  return c.json({ ...result, result_hash });
});

app.post("/v1/contradictions", async c => {
  const body = await c.req.json().catch(() => ({}));
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const contradictions: any[] = [];
  for (const claim of claims) {
    if (!claim || typeof claim !== "object") continue;
    if (claim.revenue_nzd !== undefined) {
      const { data } = await db.from("economic_outcomes").select("amount_nzd,truth_status").eq("truth_status", "VERIFIED");
      const observed = (data || []).reduce((n:any, r:any) => n + Number(r.amount_nzd || 0), 0);
      if (Number(claim.revenue_nzd) !== observed) contradictions.push({ claim, observed_revenue_nzd: observed, code: "REVENUE_MISMATCH" });
    }
    if (claim.verified_external_revenue === true) {
      const { count } = await db.from("economic_outcomes").select("outcome_id", { count: "exact", head: true }).eq("truth_status", "VERIFIED");
      if ((count || 0) === 0) contradictions.push({ claim, observed_verified_outcomes: 0, code: "NO_VERIFIED_OUTCOME" });
    }
  }
  const result = { verdict: contradictions.length ? "CONTRADICTED" : "NO_CONTRADICTION_FOUND", contradictions };
  const result_hash = await hashObject(result);
  return c.json({ ...result, result_hash });
});

app.post("/v1/passport", async c => {
  const body = await c.req.json().catch(() => ({}));
  const { order_id, outcome_id } = body;
  const { data: order } = order_id ? await db.from("revenue_orders").select("*").eq("id", order_id).maybeSingle() : { data: null };
  const { data: outcome } = outcome_id ? await db.from("economic_outcomes").select("*").eq("outcome_id", outcome_id).maybeSingle() : { data: null };
  const result = {
    passport_version: "DL-TRUTH-1",
    order,
    outcome,
    claims: { payment: Boolean(order?.status === "paid"), attribution: false, fulfillment: false, independent_evidence: false },
    verdict: "INCOMPLETE"
  };
  const result_hash = await hashObject(result);
  return c.json({ ...result, result_hash });
});

Deno.serve(app.fetch);
