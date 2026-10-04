import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "npm:hono";
import { paymentMiddleware } from "npm:@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "npm:@x402/core/server";
import { registerExactEvmScheme } from "npm:@x402/evm/exact/server";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAY_TO = Deno.env.get("X402_PAY_TO_ADDRESS") || Deno.env.get("X402_PAY_TO") || "";
const TESTNET = Deno.env.get("X402_TESTNET") !== "false";
const FACILITATOR_URL = Deno.env.get("X402_FACILITATOR_URL") || (TESTNET ? "https://x402.org/facilitator" : "");
const NETWORK = Deno.env.get("X402_NETWORK") || (TESTNET ? "eip155:84532" : "eip155:8453");
const QUOTE_ENABLED = Deno.env.get("X402_QUOTE_ENABLED") === "true";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const app = new Hono();

function decodeSettlementReceipt(header: string | null): any | null {
  if (!header) return null;
  try {
    const json = atob(header);
    const receipt = JSON.parse(json);
    return receipt && typeof receipt === "object" ? receipt : null;
  } catch {
    return null;
  }
}

async function reserveX402Replay(c: any): Promise<Response | null> {
  const header = c.req.header("X-Payment");
  if (!header || !paymentConfigured) return null;
  let payload: any;
  try { payload = JSON.parse(atob(header)); } catch { return c.json({ error: "INVALID_PAYMENT_PAYLOAD" }, 402); }
  const auth = payload?.payload?.authorization;
  const from = typeof auth?.from === "string" ? auth.from : "";
  const nonce = typeof auth?.nonce === "string" ? auth.nonce : "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(from) || !/^0x[0-9a-fA-F]{64}$/.test(nonce)) return c.json({ error: "PAYMENT_AUTHORIZATION_NOT_IDENTIFIABLE" }, 402);
  const asset = NETWORK === "eip155:84532" ? "0x036cbd53842c5426634e7929541eC2318f3dCF7e" : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const replayKey = `x402:${NETWORK}:${asset.toLowerCase()}:${from.toLowerCase()}:${nonce.toLowerCase()}`;
  const resource = new URL(c.req.url); resource.hash = "";
  const validBefore = Number(auth?.validBefore);
  const expiresAt = Number.isFinite(validBefore) && validBefore > Math.floor(Date.now() / 1000) ? new Date(validBefore * 1000).toISOString() : new Date(Date.now() + 120000).toISOString();
  const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
  const reservationToken = Array.from(tokenBytes).map(x => x.toString(16).padStart(2, "0")).join("");
  try {
    const { data, error } = await db.rpc("x402_replay_reserve", { p_replay_key: replayKey, p_resource: resource.toString(), p_reservation_token: reservationToken, p_expires_at: expiresAt });
    if (error || data !== "RESERVED") return c.json({ error: data === "RESOURCE_MISMATCH" ? "PAYMENT_RESOURCE_REPLAY" : "PAYMENT_AUTHORIZATION_ALREADY_USED" }, 402);
    return null;
  } catch { return c.json({ error: "PAYMENT_REPLAY_GUARD_UNAVAILABLE" }, 503); }
}

async function observeQuoteSettlement(c: any, next: any) {
  await next();
  const productByPath: Record<string, {product_id:string; price:number}> = {
    "/v1/compare_quotes": {product_id:"truth.quote_compare", price:0.50},
    "/v1/reconcile": {product_id:"truth.reconcile", price:0.02},
    "/v1/contradictions": {product_id:"truth.contradiction", price:0.02},
    "/v1/passport": {product_id:"truth.passport", price:0.05}
  };
  const product = productByPath[c.req.path];
  if (!product) return;
  const receipt = decodeSettlementReceipt(c.res.headers.get("PAYMENT-RESPONSE"));
  if (!receipt || receipt.success !== true) return;
  const request_hash = c.get("quote_request_hash");
  if (!request_hash) return;
  const { data: call } = await db.from("agent_toll_calls")
    .select("call_id,product_id,result,result_hash,payment_network,settlement_status")
    .eq("request_hash", request_hash).eq("product_id", product.product_id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!call) return;
  const tx = receipt.transaction || receipt.txHash || receipt.tx_hash || null;
  const payer = receipt.payer || receipt.from || null;
  if (!tx || !payer) return;
  const asset = NETWORK === "eip155:84532"
    ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const settlementKey = `x402:${call.call_id}:${tx}`;
  const { error: settlementError } = await db.from("x402_settlements").upsert({
    toll_call_id: call.call_id, idempotency_key: settlementKey, network: NETWORK, asset,
    amount_atomics: String(Math.round(product.price * 1_000_000)), amount_usdc: product.price, payer_address: payer, payee_address: PAY_TO,
    tx_hash: tx, facilitator_url: FACILITATOR_URL, facilitator_response: receipt,
    status: "PENDING", settled_at: new Date().toISOString()
  }, { onConflict: "idempotency_key" });
  if (settlementError) return;
  await db.from("agent_toll_calls").update({
    payer, payment_tx: tx,
    settlement_status: TESTNET ? "SETTLED_TESTNET_PENDING_CONFIRMATION" : "SETTLED_PENDING_CONFIRMATION",
    settled_at: new Date().toISOString()
  }).eq("call_id", call.call_id);
  const result = call.result || {};
  const decision_id = result.decision_id || `quote-${call.call_id}`;
  const evidence_hash = result.evidence_packet_hash || call.result_hash || "";
  const proofPayload = { decision_id, toll_call_id: String(call.call_id), tx_hash: tx, payer,
    evidence_hash, request_hash, response_hash: call.result_hash || "" };
  const proofDigest = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(canonical(proofPayload)));
  const chain_hash = Array.from(new Uint8Array(proofDigest))
    .map(x => x.toString(16).padStart(2, "0")).join("");
  const { data: proof } = await db.from("runtime_proofs").insert({
    execution_id: call.call_id, toll_call_id: call.call_id, proof_type: "DELIVERY_RECEIPT",
    request_hash, response_hash: call.result_hash || "", artifact_hash: evidence_hash, chain_hash,
    source_reference: tx, source_system: "agent-toll-road",
    metadata: { decision_id, product_id: product.product_id, price_usd: product.price, network: NETWORK, testnet: TESTNET, payer, payee: PAY_TO }
  }).select("proof_id").single();
  if (!proof) return;
  const event_id = `X402-${call.call_id}`;
  const { data: existing } = await db.from("economic_events").select("event_id")
    .eq("event_id", event_id).maybeSingle();
  if (existing) return;
  // A facilitator acknowledgement and transaction hash are observations, not durable
  // settlement. x402-reconcile independently verifies the chain transfer and confirmations.
  // Keep the economic event observable for reconciliation, but fail closed on settlement
  // until that independent confirmation exists.
  await db.from("economic_events").insert({
    event_id, silo_id: "agent-toll-road", sku_id: product.product_id,
    buyer_action_verified: true, payment_settled: false, fulfilment_verified: true, evidence_verified: true,
    evidence_ref: proof.proof_id, payment_reference: tx, verification_status: "UNMATCHED",
    observation_mode: "OBSERVED", scope: "EXTERNAL", event_type: "X402_PAYMENT_OBSERVED",
    state_before: "UNMATCHED", state_after: "UNMATCHED",
    settlement_state: "SETTLED_PENDING_CONFIRMATION", fulfillment_state: "FULFILLED",
    verification_state: "UNMATCHED", source: "agent-toll-road", source_system: "x402",
    source_record_id: String(call.call_id), external_reference: payer,
    input_hash: request_hash, output_hash: call.result_hash,
    metadata: { network: NETWORK, payer, payee: PAY_TO, transaction: tx, testnet: TESTNET, product_id: product.product_id, price_usd: product.price,
      scoreboard_eligible: false, toll_call_id: String(call.call_id), decision_id,
      settlement_idempotency_key: settlementKey, settlement_confirmation_required: true }
  });
}

app.use("*", observeQuoteSettlement);

app.get("/healthz", c => c.json({
  ok: true,
  service: "agent-toll-road",
  payment_mode: PAY_TO && FACILITATOR_URL ? "x402" : "DISABLED_UNCONFIGURED",
  quote_compare_mode: QUOTE_ENABLED && PAY_TO && FACILITATOR_URL ? "ENABLED" : "DISABLED",
  network: NETWORK
}));

app.get("/.well-known/x402", async c => {
  const { data, error } = await db.from("agent_toll_products")
    .select("product_id,name,price_usd,endpoint,description").eq("active", true).order("product_id");
  if (error) return c.json({ error:"DISCOVERY_UNAVAILABLE" },503);
  return c.json({
    x402Version: 2,
    service: "DreamLedger Truth Toll Road",
    network: NETWORK,
    asset: NETWORK === "eip155:84532"
      ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
      : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: PAY_TO || null,
    products: data
  });
});

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

async function recordCall(body: any, result: any, settlement_status: string, product_id = "truth.quote_compare") {
  const request_hash = await hashObject(body);
  const result_hash = await hashObject(result);
  const { data, error } = await db.from("agent_toll_calls").insert({
    product_id,
    payer: "",
    payment_tx: null,
    payment_network: NETWORK,
    payment_amount_usd: 0.50,
    settlement_status,
    request_hash,
    result_hash,
    result
  }).select("call_id").single();
  if (error) throw error;
  return { call_id: data.call_id, request_hash, result_hash };
}

let paymentConfigured = false;
if (PAY_TO && FACILITATOR_URL) {
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
  paymentConfigured = true;
}

app.use("*", async (c, next) => {
  if (!paymentConfigured) return next();
  const paidPaths = new Set(["/v1/reconcile","/v1/contradictions","/v1/passport","/v1/compare_quotes"]);
  if (!paidPaths.has(c.req.path) || c.req.method !== "POST") return next();
  const guardResponse = await reserveX402Replay(c);
  if (guardResponse) return guardResponse;
  return next();
});

app.post("/v1/compare_quotes", async c => {
  if (!paymentConfigured) return c.json({ error: "PAYMENT_RAIL_NOT_CONFIGURED", service: "agent-toll-road" }, 503);
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
  const call = await recordCall(body, result, "VERIFIED_FOR_FULFILLMENT_PENDING_SETTLEMENT");
  c.set("quote_request_hash", call.request_hash);
  return c.json({ ...result, toll_call_id: call.call_id });
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
  const call = await recordCall(body, result, "VERIFIED_FOR_FULFILLMENT_PENDING_SETTLEMENT", "truth.reconcile");
  c.set("quote_request_hash", call.request_hash);
  return c.json({ ...result, result_hash, toll_call_id: call.call_id });
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
  const call = await recordCall(body, result, "VERIFIED_FOR_FULFILLMENT_PENDING_SETTLEMENT", "truth.contradiction");
  c.set("quote_request_hash", call.request_hash);
  return c.json({ ...result, result_hash, toll_call_id: call.call_id });
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
  const call = await recordCall(body, result, "VERIFIED_FOR_FULFILLMENT_PENDING_SETTLEMENT", "truth.passport");
  c.set("quote_request_hash", call.request_hash);
  return c.json({ ...result, result_hash, toll_call_id: call.call_id });
});

Deno.serve(app.fetch);
