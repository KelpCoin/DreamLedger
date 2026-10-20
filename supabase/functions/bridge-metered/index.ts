import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "npm:hono";
import { paymentMiddleware, setSettlementOverrides, x402ResourceServer } from "npm:@x402/hono";
import { HTTPFacilitatorClient } from "npm:@x402/core/server";
import { UptoEvmScheme } from "npm:@x402/evm/upto/server";

const PAY_TO = Deno.env.get("X402_PAY_TO_ADDRESS") || "";
const TESTNET = Deno.env.get("X402_TESTNET") !== "false";
const NETWORK = Deno.env.get("X402_METERED_NETWORK") || (TESTNET ? "eip155:84532" : "eip155:8453");
const FACILITATOR_URL = Deno.env.get("X402_FACILITATOR_URL") || (TESTNET ? "https://x402.org/facilitator" : "");
const WORKER_URL = Deno.env.get("BRIDGE_INFERENCE_WORKER_URL") || "";
const WORKER_TOKEN = Deno.env.get("BRIDGE_INFERENCE_WORKER_TOKEN") || "";
const ENABLED = Deno.env.get("BRIDGE_METERED_INFERENCE_ENABLED") === "true";

const MAX_ATOMIC = 100000n; // 0.10 USDC
const RATE_ATOMIC = 100n; // 0.0001 USDC per generated token
const ATOMIC_PER_USDC = 1000000n;
const HASH_RE = /^[0-9a-f]{64}$/;

function safeConfiguredWorkerUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    const m = host.match(/^172\.(\d+)\./);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return null;
    if (host === "::1" || host === "[::1]" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:") || host === "0.0.0.0") return null;
    return url;
  } catch {
    return null;
  }
}

function chargeForGeneratedTokens(tokens: number) {
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new TypeError("invalid_generated_token_count");
  const calculated = BigInt(tokens) * RATE_ATOMIC;
  const actual = calculated > MAX_ATOMIC ? MAX_ATOMIC : calculated;
  return {
    actual_atomic: actual.toString(),
    actual_usdc: (Number(actual) / Number(ATOMIC_PER_USDC)).toFixed(6),
    capped: calculated > MAX_ATOMIC
  };
}

async function sha256Utf8Async(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const app = new Hono();

// The payment middleware settles after the handler returns. This outer middleware
// copies the facilitator-reported transaction reference into the delivery envelope
// without changing the SHA-256 digest of the delivered text. Independent chain
// reconciliation is still required, so this does not recognize revenue.
app.use("*", async (c, next) => {
  await next();
  if (c.req.path !== "/v1/metered_inference" || !c.res || c.res.status >= 400) return;
  const encoded = c.res.headers.get("PAYMENT-RESPONSE");
  if (!encoded) return;
  try {
    const payment = JSON.parse(atob(encoded));
    if (payment.success !== true) return;
    const tx = payment.transaction || payment.txHash || payment.tx_hash || null;
    if (typeof tx !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(tx)) return;
    const original = c.res;
    const body = await original.clone().json();
    if (!body || !body.delivery_receipt || !HASH_RE.test(body.delivery_receipt.payload_sha256 || "")) return;
    body.delivery_receipt.settlement_tx_hash = tx;
    body.delivery_receipt.settlement_finality = "FACILITATOR_REPORTED_SUCCESS_PENDING_INDEPENDENT_CHAIN_RECONCILIATION";
    body.delivery_receipt.revenue_recognized = false;
    c.res = new Response(JSON.stringify(body), {
      status: original.status,
      statusText: original.statusText,
      headers: new Headers(original.headers)
    });
  } catch {
    // Keep the original handler response if the optional receipt envelope is malformed.
  }
});

const workerUrl = safeConfiguredWorkerUrl(WORKER_URL);
const paymentReady = Boolean(ENABLED && PAY_TO && FACILITATOR_URL && workerUrl && WORKER_TOKEN);

if (paymentReady) {
  const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitator)
    .register(NETWORK, new UptoEvmScheme());

  app.use(paymentMiddleware({
    "POST /v1/metered_inference": {
      accepts: [{
        scheme: "upto",
        price: "$0.10",
        network: NETWORK,
        payTo: PAY_TO
      }],
      description: "Local-worker inference metered at 0.0001 USDC per generated token, capped at 0.10 USDC.",
      mimeType: "application/json"
    }
  }, resourceServer));
}

app.get("/healthz", (c) => c.json({
  service: "bridge-metered",
  status: paymentReady ? "configured" : "blocked_missing_configuration",
  tool: "metered_inference",
  scheme: "upto",
  network: NETWORK,
  maximum_price_usdc: "0.10",
  actual_usage_rate_usdc_per_generated_token: "0.0001",
  escrowed_async_task: "BLOCKED_NO_APPROVED_ESCROW_CONTRACT"
}));

app.post("/v1/metered_inference", async (c) => {
  if (!paymentReady || !workerUrl) {
    return c.json({ error: "METERED_INFERENCE_NOT_CONFIGURED", status: "BLOCKED" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 20000) {
    return c.json({ error: "PROMPT_REQUIRED_MAX_20000_CHARS" }, 400);
  }
  const maxTokens = body.max_output_tokens === undefined ? 1000 : Number(body.max_output_tokens);
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1000) {
    return c.json({ error: "MAX_OUTPUT_TOKENS_MUST_BE_1_TO_1000" }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(workerUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + WORKER_TOKEN
      },
      body: JSON.stringify({ prompt: body.prompt, max_output_tokens: maxTokens }),
      signal: AbortSignal.timeout(120000)
    });
  } catch {
    return c.json({ error: "INFERENCE_WORKER_UNAVAILABLE", status: "NOT_SETTLED" }, 503);
  }
  if (!upstream.ok) {
    return c.json({ error: "INFERENCE_WORKER_FAILED", upstream_status: upstream.status, status: "NOT_SETTLED" }, 502);
  }

  const generated = await upstream.json().catch(() => null);
  if (!generated || typeof generated.text !== "string" ||
      !generated.usage || !Number.isSafeInteger(generated.usage.generated_tokens) ||
      generated.usage.generated_tokens < 0 || generated.usage.generated_tokens > maxTokens) {
    return c.json({ error: "INVALID_WORKER_USAGE_RESPONSE", status: "NOT_SETTLED" }, 502);
  }

  const charge = chargeForGeneratedTokens(generated.usage.generated_tokens);
  const payloadHash = await sha256Utf8Async(generated.text);
  const receipt = {
    schema: "dreamledger/agent-bridge-delivery-receipt/v1",
    tool: "metered_inference",
    payload_sha256: payloadHash,
    payload_bytes: new TextEncoder().encode(generated.text).length,
    delivered_at: new Date().toISOString(),
    settlement_tx_hash: null,
    settlement_finality: "PENDING_X402_MIDDLEWARE_RECEIPT",
    revenue_recognized: false
  };

  // The x402 Hono middleware consumes this override after successful handler execution.
  // Amount is in USDC atomic units and cannot exceed the $0.10 authorized maximum.
  setSettlementOverrides(c, { amount: charge.actual_atomic });
  return c.json({
    text: generated.text,
    usage: {
      generated_tokens: generated.usage.generated_tokens,
      rate_usdc_per_generated_token: "0.0001",
      charged_usdc: charge.actual_usdc,
      max_price_usdc: "0.10",
      capped: charge.capped
    },
    delivery_receipt: receipt,
    economic_truth: "UNVERIFIED_UNTIL_PAYMENT_RESPONSE_AND_DELIVERY_RECONCILE"
  });
});

// The escrow endpoint deliberately remains fail-closed. A real escrow deployment needs
// a reviewed Base contract address/ABI and verified fund/release/refund event checks.
app.post("/v1/async_task", (c) => c.json({
  error: "ESCROW_NOT_CONFIGURED",
  status: "BLOCKED",
  required: [
    "approved Base escrow contract address and ABI",
    "USDC token address and chain verification",
    "independent evaluator identity",
    "fund/release/refund transaction verification",
    "durable task store and worker"
  ]
}, 503));

app.notFound((c) => c.json({ error: "NOT_FOUND" }, 404));

Deno.serve(app.fetch);
