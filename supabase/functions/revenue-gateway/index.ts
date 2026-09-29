import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";
import type {
  CapabilityFacts,
  GatewayConfig,
  GatewayResponse,
  HealthStatus,
  ReasonCode,
  ServicePromise,
  TruthStatus,
  DegradedMode,
  GatewayDecision,
} from "./types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_API_KEY =
  Deno.env.get("STRIPE_API_KEY") ??
  Deno.env.get("STRIPE_SECRET_KEY") ??
  "";
const WORKER_SLUG =
  Deno.env.get("QUOTE_FULFILLMENT_FUNCTION") ?? "quote-fulfillment";
const BUCKET =
  Deno.env.get("QUOTE_FULFILLMENT_BUCKET") ?? "marketplace-fulfillment";
const DEFAULT_SKU = "QUOTE-COMPARE-49";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripe = STRIPE_API_KEY ? new Stripe(STRIPE_API_KEY) : null;

const cors = {
  "Access-Control-Allow-Origin": "https://dreamledger.org",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...cors,
    },
  });
}

function validPromise(value: unknown): value is ServicePromise {
  return ["FULL", "REDUCED", "QUEUED", "REFUSED"].includes(String(value));
}

function validDegraded(value: unknown): value is DegradedMode {
  return ["NORMAL", "DEGRADED_FALLBACK", "DEGRADED_QUEUE"].includes(
    String(value),
  );
}

function validConfig(row: any): row is GatewayConfig {
  return Boolean(
    row &&
      typeof row.sku === "string" &&
      validPromise(row.service_promise) &&
      validPromise(row.current_mode) &&
      validDegraded(row.degraded_mode) &&
      typeof row.can_accept_payment === "boolean" &&
      typeof row.expected_delivery === "string" &&
      typeof row.evidence_required === "boolean" &&
      Number.isInteger(Number(row.config_version)) &&
      Number(row.config_version) > 0 &&
      Number(row.failure_threshold) >= 1 &&
      Number(row.sustained_failure_seconds) >= 0 &&
      Number(row.health_ttl_seconds) >= 0 &&
      Number(row.queue_capacity) >= 0 &&
      Number(row.queue_max_age_seconds) >= 0,
  );
}

async function getConfig(sku: string): Promise<GatewayConfig | null> {
  const { data, error } = await db
    .from("revenue_gateway_config")
    .select(
      "sku,service_promise,current_mode,degraded_mode,fallback_path,can_accept_payment,expected_delivery,evidence_required,config_version,failure_threshold,sustained_failure_seconds,health_ttl_seconds,queue_capacity,queue_max_age_seconds,health_summary,last_health_check_at,updated_at",
    )
    .eq("sku", sku)
    .maybeSingle();

  if (error) throw new Error(`GATEWAY_CONFIG_LOOKUP_FAILED:${error.message}`);
  if (!data) return null;
  if (!validConfig(data)) throw new Error("INVALID_CONFIGURATION");
  if (data.current_mode === "REDUCED" && !data.fallback_path) {
    throw new Error("INVALID_CONFIGURATION");
  }
  if (data.current_mode === "QUEUED" && Number(data.queue_capacity) <= 0) {
    throw new Error("INVALID_CONFIGURATION");
  }
  return data as GatewayConfig;
}

async function checkDatabase(): Promise<{ status: HealthStatus; detail: string }> {
  const { error } = await db
    .from("revenue_catalog")
    .select("sku_id")
    .eq("sku_id", DEFAULT_SKU)
    .limit(1);
  if (error) return { status: "FAILED", detail: "revenue_catalog read failed" };
  return { status: "HEALTHY", detail: "authoritative catalog read succeeded" };
}

async function checkStorage(): Promise<{ status: HealthStatus; detail: string }> {
  const { data, error } = await db.storage.listBuckets();
  if (error) return { status: "FAILED", detail: "storage bucket listing failed" };
  const found = Array.isArray(data) && data.some((b: any) => b.name === BUCKET);
  return found
    ? { status: "CAPABLE", detail: `bucket ${BUCKET} is visible` }
    : { status: "FAILED", detail: `bucket ${BUCKET} not visible` };
}

async function checkWorker(): Promise<{ status: HealthStatus; detail: string }> {
  if (!SUPABASE_URL) return { status: "FAILED", detail: "SUPABASE_URL missing" };
  const url = `${SUPABASE_URL}/functions/v1/${WORKER_SLUG}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "cache-control": "no-cache" },
    });
    if (response.status === 405) {
      return {
        status: "REACHABLE",
        detail: "worker endpoint responded POST_REQUIRED/405; no fulfillment invoked",
      };
    }
    return {
      status: response.ok ? "HEALTHY" : "FAILED",
      detail: `worker GET returned HTTP ${response.status}; capability not inferred from 200`,
    };
  } catch {
    return { status: "FAILED", detail: "worker endpoint unreachable" };
  }
}

async function checkPaymentBoundary(catalog: any): Promise<{
  status: HealthStatus;
  detail: string;
  aligned: boolean;
}> {
  if (!stripe) return { status: "FAILED", detail: "Stripe API key unavailable", aligned: false };

  const linkId = String(catalog?.stripe_payment_link ?? "");
  const expectedPrice = Number(catalog?.price_nzd ?? 0);
  const expectedFulfillment = String(catalog?.fulfillment_type ?? "");
  if (!linkId) return { status: "FAILED", detail: "catalog has no Stripe payment link", aligned: false };

  try {
    const link = await stripe.paymentLinks.retrieve(linkId);
    const lineItems = await stripe.paymentLinks.listLineItems(linkId, { limit: 10 });
    const amount = Number(lineItems.data?.[0]?.price?.unit_amount ?? -1) / 100;
    const currency = String(lineItems.data?.[0]?.price?.currency ?? "").toUpperCase();
    const linkFulfillment = String(
      (link.metadata as Record<string, string> | null)?.fulfillment ?? "",
    );

    const priceAligned = link.active === true && currency === "NZD" && amount === expectedPrice;
    const fulfillmentAligned = !linkFulfillment || linkFulfillment === expectedFulfillment;

    if (!priceAligned) {
      return {
        status: "FAILED",
        detail: "Stripe payment link is inactive or price/currency disagrees with catalog",
        aligned: false,
      };
    }
    if (!fulfillmentAligned) {
      return {
        status: "FAILED",
        detail: `Stripe metadata fulfillment=${linkFulfillment} conflicts with catalog fulfillment_type=${expectedFulfillment}`,
        aligned: false,
      };
    }
    return {
      status: "CAPABLE",
      detail: "Stripe live payment boundary matches catalog price/currency/fulfillment contract",
      aligned: true,
    };
  } catch {
    return { status: "FAILED", detail: "Stripe payment-link inspection failed", aligned: false };
  }
}

async function getFacts(config: GatewayConfig): Promise<{
  capability: CapabilityFacts;
  catalog: any;
  paymentReason: string | null;
}> {
  const dbCheck = await checkDatabase();
  const { data: catalog, error: catalogError } = await db
    .from("revenue_catalog")
    .select(
      "sku_id,name,price_nzd,stripe_product_id,stripe_price_id,stripe_payment_link,active,fulfillment_type,currency",
    )
    .eq("sku_id", config.sku)
    .maybeSingle();

  if (catalogError) {
    return {
      capability: {
        database: "FAILED", storage: "FAILED", payment_boundary: "FAILED",
        fulfillment_worker: "FAILED", extraction_comparison: "UNKNOWN",
        output_generation: "UNKNOWN", delivery: "UNKNOWN",
        commercial_contract_aligned: false, health_fresh: false,
      },
      catalog: null,
      paymentReason: "catalog lookup failed",
    };
  }

  if (!catalog || catalog.active !== true) {
    return {
      capability: {
        database: dbCheck.status, storage: "UNKNOWN", payment_boundary: "FAILED",
        fulfillment_worker: "UNKNOWN", extraction_comparison: "UNKNOWN",
        output_generation: "UNKNOWN", delivery: "UNKNOWN",
        commercial_contract_aligned: false, health_fresh: false,
      },
      catalog,
      paymentReason: "SKU_NOT_CONFIGURED_OR_INACTIVE",
    };
  }

  const storage = await checkStorage();
  const worker = await checkWorker();
  const payment = await checkPaymentBoundary(catalog);

  const extraction: HealthStatus =
    worker.status === "REACHABLE" || worker.status === "HEALTHY"
      ? "CAPABLE"
      : "UNKNOWN";
  const output: HealthStatus = storage.status === "CAPABLE" ? "CAPABLE" : "UNKNOWN";
  const delivery: HealthStatus = storage.status === "CAPABLE" ? "CAPABLE" : "UNKNOWN";

  return {
    capability: {
      database: dbCheck.status,
      storage: storage.status,
      payment_boundary: payment.status,
      fulfillment_worker: worker.status,
      extraction_comparison: extraction,
      output_generation: output,
      delivery,
      commercial_contract_aligned: payment.aligned,
      health_fresh: true,
    },
    catalog,
    paymentReason: payment.aligned ? null : payment.detail,
  };
}

function choose(config: GatewayConfig, facts: CapabilityFacts) {
  const full =
    facts.database !== "FAILED" &&
    facts.storage === "CAPABLE" &&
    ["REACHABLE", "HEALTHY", "CAPABLE", "FULFILLABLE"].includes(facts.fulfillment_worker) &&
    facts.extraction_comparison === "CAPABLE" &&
    facts.output_generation === "CAPABLE" &&
    facts.delivery === "CAPABLE" &&
    facts.payment_boundary === "CAPABLE" &&
    facts.commercial_contract_aligned &&
    facts.health_fresh;

  if (!facts.commercial_contract_aligned) {
    return {
      decision: "REFUSE" as GatewayDecision,
      servicePromise: "REFUSED" as ServicePromise,
      degradedMode: "NORMAL" as DegradedMode,
      canAcceptPayment: false,
      reasonCode: "COMMERCIAL_CONTRACT_CONFLICT" as ReasonCode,
      truthStatus: "INTERNAL" as TruthStatus,
      atomicityGap: true,
    };
  }

  if (full && config.service_promise === "FULL") {
    return {
      decision: "ACCEPT" as GatewayDecision,
      servicePromise: "FULL" as ServicePromise,
      degradedMode: "NORMAL" as DegradedMode,
      canAcceptPayment: true,
      reasonCode: "FULFILLMENT_CAPABLE" as ReasonCode,
      truthStatus: "INTERNAL" as TruthStatus,
      atomicityGap: true,
    };
  }

  if (config.fallback_path && config.service_promise !== "QUEUED" && facts.health_fresh) {
    return {
      decision: "ACCEPT_REDUCED" as GatewayDecision,
      servicePromise: "REDUCED" as ServicePromise,
      degradedMode: "DEGRADED_FALLBACK" as DegradedMode,
      canAcceptPayment: true,
      reasonCode: "REDUCED_FALLBACK_CAPABLE" as ReasonCode,
      truthStatus: "INTERNAL" as TruthStatus,
      atomicityGap: true,
    };
  }

  if (config.queue_capacity > 0 && config.queue_max_age_seconds > 0 && config.service_promise === "QUEUED") {
    return {
      decision: "HUMAN_POLICY_REQUIRED" as GatewayDecision,
      servicePromise: "QUEUED" as ServicePromise,
      degradedMode: "DEGRADED_QUEUE" as DegradedMode,
      canAcceptPayment: false,
      reasonCode: "HUMAN_POLICY_REQUIRED" as ReasonCode,
      truthStatus: "INTERNAL" as TruthStatus,
      atomicityGap: true,
    };
  }

  return {
    decision: "REFUSE" as GatewayDecision,
    servicePromise: "REFUSED" as ServicePromise,
    degradedMode: "NORMAL" as DegradedMode,
    canAcceptPayment: false,
    reasonCode: "REFUSED_NO_VALID_MODE" as ReasonCode,
    truthStatus: "INTERNAL" as TruthStatus,
    atomicityGap: true,
  };
}

async function statusFor(sku: string): Promise<GatewayResponse> {
  const config = await getConfig(sku);
  if (!config) throw new Error("SKU_NOT_CONFIGURED");
  const { capability } = await getFacts(config);
  const chosen = choose(config, capability);
  return {
    sku,
    decision: chosen.decision,
    can_accept_payment: chosen.canAcceptPayment,
    service_promise: chosen.servicePromise,
    degraded_mode: chosen.degradedMode,
    expected_delivery: config.expected_delivery,
    fallback_path: config.fallback_path,
    evidence_required: config.evidence_required,
    reason_code: chosen.reasonCode,
    truth_status: chosen.truthStatus,
    capability,
    atomicity_gap: chosen.atomicityGap,
    economic_effect: 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: cors });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return out({ error: "SERVICE_NOT_CONFIGURED", truth_status: "INTERNAL", economic_effect: 0 }, 503);
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const sku = String(body.sku ?? url.searchParams.get("sku") ?? parts.at(-1) ?? DEFAULT_SKU);

  if (sku !== DEFAULT_SKU) {
    return out({
      error: "SKU_NOT_SUPPORTED",
      sku,
      reason_code: "SKU_NOT_CONFIGURED",
      truth_status: "INTERNAL",
      economic_effect: 0,
    }, 400);
  }

  try {
    if (req.method === "GET" && parts.at(-2) === "status") {
      return out(await statusFor(sku));
    }
    const action = String(body.action ?? parts.at(-1) ?? "");
    if (action === "status" || action === "checkout-check" || action === "fulfill-check") {
      return out(await statusFor(sku));
    }
    return out({
      error: "ACTION_REQUIRED",
      supported_actions: ["status", "checkout-check", "fulfill-check"],
      truth_status: "INTERNAL",
      economic_effect: 0,
    }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return out({
      error: message,
      reason_code: message === "INVALID_CONFIGURATION" ? "INVALID_CONFIGURATION" : "DATABASE_UNAVAILABLE",
      truth_status: "INTERNAL",
      economic_effect: 0,
    }, message === "SKU_NOT_CONFIGURED" ? 404 : 500);
  }
});
