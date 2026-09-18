import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_KEY = Deno.env.get("STRIPE_API_KEY") || Deno.env.get("STRIPE_SECRET_KEY") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_KEY);
const SKU = "B2B-EVIDENCE-AUDIT-001";
const BUCKET = "marketplace-fulfillment";
const VERIFIER = "b2b-evidence-audit-fulfillment-v2";
const SIGNED_URL_TTL_SECONDS = 86400;

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function validUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1" || h === "::1") return false;
    if (/^(10\.|192\.168\.|169\.254\.)/.test(h)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchEvidence(sourceUrl: string): Promise<{status:number; contentType:string; body:string}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "DreamLedger-B2B-Evidence-Audit/2.0" },
    });
    return {
      status: res.status,
      contentType: res.headers.get("content-type") || "unknown",
      body: (await res.text()).replaceAll("\r", "").slice(0, 12000),
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildMarkdown(input: {
  claim:string;
  sourceUrl:string;
  status:number;
  contentType:string;
  body:string;
  orderId:string;
  sessionId:string;
  paidAt:string;
  buyerEmail:string;
}): string {
  const excerpt = input.body.slice(0, 4000);
  const retrievalVerdict = input.status >= 200 && input.status < 400
    ? "The supplied source responded successfully. The claim must be evaluated against the retrieved evidence below; this report does not infer facts that are not present in the source."
    : `The supplied source returned HTTP ${input.status}. The claim cannot be treated as verified from this retrieval alone.`;
  return [
    "# DreamLedger Evidence / Claim Audit", "",
    "## Scope", `Fixed-scope independent review for ${SKU}. This report records only evidence actually retrieved during fulfillment.`, "",
    "## Claim", input.claim, "",
    "## Evidence Reviewed",
    `Source URL: ${input.sourceUrl}`,
    `HTTP status: ${input.status}`,
    `Content-Type: ${input.contentType}`,
    `Retrieved during paid order fulfillment: ${input.paidAt}`,
    "",
    "Evidence excerpt (first 4,000 characters):",
    "```text", excerpt, "```", "",
    "## Findings", retrievalVerdict, "",
    "## Risk / Consequence", "If the claim is relied upon without stronger primary evidence, the decision may inherit errors, omissions, stale information, or interpretation not supported by the supplied source.", "",
    "## Proof",
    `Stripe checkout session: ${input.sessionId}`,
    `DreamLedger order: ${input.orderId}`,
    `Buyer attribution: ${input.buyerEmail ? "settled checkout email present" : "UNKNOWN"}`,
    `Paid timestamp: ${input.paidAt}`,
    `Fulfillment SKU: ${SKU}`,
    "",
    "## Remediation", "Where the evidence is incomplete or ambiguous, obtain a stronger primary source, reproduce the underlying behavior, or narrow the claim before relying on it.", "",
    "## Verification Method", "Deterministic checks: settled live Stripe session, exact SKU and listing, paid marketplace order linkage, buyer attribution, required buyer fields, source retrieval, artifact SHA-256, private storage record, idempotent fulfillment claim, and completion evidence.", "",
    "## Limitations", "This is a fixed-scope evidence review, not a legal opinion, penetration test, financial audit, or guarantee of truth beyond the evidence retrieved. Source retrieval is bounded and does not by itself establish that a claim is true."
  ].join("\n");
}

async function recordEvent(fulfillmentId: string, fromStatus: string | null, toStatus: string, evidenceRef: string | null, note: string) {
  await admin.from("marketplace_fulfillment_events").insert({
    fulfillment_id: fulfillmentId,
    from_status: fromStatus,
    to_status: toStatus,
    evidence_ref: evidenceRef,
    note,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("GET only", { status: 405 });
  const sessionId = new URL(req.url).searchParams.get("session_id") || "";
  if (!sessionId) return new Response("Missing session_id", { status: 400 });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session.livemode || session.payment_status !== "paid") return new Response("Payment not settled", { status: 409 });

    const meta = session.metadata || {};
    if (String(meta.sku || "") !== SKU) return new Response("Wrong SKU", { status: 400 });
    const listingId = String(meta.marketplace_listing_id || "");
    if (!listingId) return new Response("Missing marketplace listing", { status: 400 });

    const { data: listing } = await admin.from("marketplace_listings")
      .select("id,sku,title,price_nzd,status")
      .eq("id", listingId).single();
    if (!listing || listing.sku !== SKU || listing.status !== "published") return new Response("Listing unavailable", { status: 409 });

    const { data: order } = await admin.from("marketplace_orders")
      .select("id,checkout_session_id,payment_status,fulfillment_status,order_state,buyer_email,state_version")
      .eq("checkout_session_id", sessionId).eq("listing_id", listingId).single();
    if (!order || order.payment_status !== "paid") return new Response("Order settlement not yet visible", { status: 409 });

    const { data: fulfillment } = await admin.from("marketplace_fulfillments")
      .select("fulfillment_id,status,order_id,metadata,input_payload,delivery_url,evidence_ref")
      .eq("order_id", order.id).limit(1).maybeSingle();
    if (!fulfillment) return new Response("Fulfillment record not found", { status: 409 });

    if (fulfillment.status === "fulfilled" || fulfillment.status === "delivered") {
      const existingUrl = String(fulfillment.delivery_url || "");
      return new Response(`Already fulfilled${existingUrl ? `: ${esc(existingUrl)}` : ""}`, { status: 200 });
    }

    const custom = (session as any).custom_fields || [];
    const values: Record<string,string> = {};
    for (const f of custom) values[String(f.key || "")] = String(f.text?.value || f.numeric?.value || f.dropdown?.value || "");
    const claim = values.claim || "";
    const sourceUrl = values.source_url || "";
    if (!claim || !sourceUrl) return new Response("Required buyer fields missing: source_url and claim", { status: 409 });
    if (!validUrl(sourceUrl)) return new Response("Source URL is not an allowed public HTTP(S) URL", { status: 400 });

    const buyerEmail = String(order.buyer_email || (session.customer_details?.email || ""));
    const now = new Date().toISOString();

    const { data: claimed } = await admin.from("marketplace_fulfillments")
      .update({
        status: "in_progress",
        claimed_by: VERIFIER,
        claimed_at: now,
        lease_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attempt_count: Number(fulfillment.attempt_count || 0) + 1,
        input_payload: { source_url: sourceUrl, claim, buyer_attribution: buyerEmail ? "present" : "unknown" },
        updated_at: now,
      })
      .eq("fulfillment_id", fulfillment.fulfillment_id)
      .eq("status", fulfillment.status)
      .select("fulfillment_id,status")
      .maybeSingle();

    if (!claimed) {
      const { data: reread } = await admin.from("marketplace_fulfillments")
        .select("status,delivery_url").eq("fulfillment_id", fulfillment.fulfillment_id).single();
      if (reread?.status === "fulfilled" || reread?.status === "delivered") return new Response(`Already fulfilled: ${esc(String(reread.delivery_url || ""))}`, { status: 200 });
      return new Response("Fulfillment is already claimed or changed state", { status: 409 });
    }
    await recordEvent(fulfillment.fulfillment_id, fulfillment.status, "in_progress", null, "Idempotent fulfillment claim acquired.");

    const evidence = await fetchEvidence(sourceUrl);
    const paidAt = new Date((session.created || Math.floor(Date.now()/1000)) * 1000).toISOString();
    const markdown = buildMarkdown({ claim, sourceUrl, status:evidence.status, contentType:evidence.contentType, body:evidence.body, orderId:order.id, sessionId, paidAt, buyerEmail });
    const bytes = new TextEncoder().encode(markdown);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
    const path = `b2b-evidence-audit/${order.id}/${sha}.md`;

    const upload = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "text/markdown; charset=utf-8",
      upsert: true,
    });
    if (upload.error) {
      await admin.from("marketplace_fulfillments").update({ status:"failed", failure_reason:"Artifact upload failed", updated_at:new Date().toISOString() }).eq("fulfillment_id", fulfillment.fulfillment_id).eq("status","in_progress");
      return new Response("Artifact upload failed", { status: 500 });
    }

    const { data: artifact, error: artifactError } = await admin.from("marketplace_fulfillment_artifacts")
      .upsert({
        fulfillment_id: fulfillment.fulfillment_id,
        storage_bucket: BUCKET,
        storage_path: path,
        sha256: sha,
        mime_type: "text/markdown",
        byte_size: bytes.byteLength,
        verifier_version: VERIFIER,
        metadata: { sku:SKU, claim, source_url:sourceUrl, evidence_http_status:evidence.status, buyer_attribution:buyerEmail ? "present" : "unknown" },
      }, { onConflict:"fulfillment_id" }).select("artifact_id,sha256,storage_path").single();
    if (artifactError || !artifact || artifact.sha256 !== sha) return new Response("Artifact record or hash verification failed", { status: 500 });
    const evidenceRef = `artifact:${artifact.artifact_id}`;
    await recordEvent(fulfillment.fulfillment_id, "in_progress", "fulfilled", evidenceRef, "Artifact generated and SHA-256 verified.");

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (!signed?.signedUrl) return new Response("Delivery URL generation failed", { status: 500 });

    const { error: fError } = await admin.from("marketplace_fulfillments").update({
      status: "fulfilled",
      delivery_url: signed.signedUrl,
      evidence_ref: evidenceRef,
      delivered_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      lease_expires_at: null,
      metadata: {
        sku:SKU,
        evidence_state:"VERIFIED",
        artifact_id:artifact.artifact_id,
        artifact_sha256:sha,
        source_url:sourceUrl,
        claim,
        buyer_attribution:buyerEmail ? "present" : "unknown",
        verifier_version:VERIFIER,
      },
      updated_at:new Date().toISOString(),
    }).eq("fulfillment_id", fulfillment.fulfillment_id).eq("status","in_progress");
    if (fError) return new Response("Fulfillment update failed", { status:500 });

    const nextVersion = Number(order.state_version || 1) + 1;
    const { error: orderError } = await admin.from("marketplace_orders").update({
      fulfillment_status:"fulfilled",
      order_state:"complete",
      state_version:nextVersion,
      state_updated_at:new Date().toISOString(),
      evidence_id:evidenceRef,
    }).eq("id", order.id).eq("payment_status","paid").eq("state_version", order.state_version || 1);
    if (orderError) return new Response("Order completion update failed", { status:500 });

    await admin.from("marketplace_fulfillment_artifacts").update({
      delivery_verified_at:new Date().toISOString(),
    }).eq("artifact_id", artifact.artifact_id).eq("sha256", sha);

    await admin.from("marketplace_audit_events").insert({
      entity_type:"order",
      entity_id:order.id,
      action:"FULFILLMENT_VERIFIED",
      from_state:"fulfillment",
      to_state:"complete",
      evidence_ref:evidenceRef,
      idempotency_key:`b2b-evidence-audit:${order.id}:${sha}`,
      metadata:{
        sku:SKU,
        artifact_sha256:sha,
        source_url:sourceUrl,
        claim,
        buyer_attribution:buyerEmail ? "present" : "unknown",
        verifier_version:VERIFIER,
      },
    });

    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evidence / Claim Audit</title><style>body{font:16px system-ui;max-width:760px;margin:60px auto;padding:20px;background:#0a0b0e;color:#f7f4ee}a{color:#0a0b0e;background:#c9a24b;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700}.box{border:1px solid #444;padding:18px;border-radius:10px}code{color:#c9a24b}</style></head><body><h1>Evidence / Claim Audit</h1><div class="box"><p>Payment settled and fulfillment verified.</p><p>Order: <code>${esc(order.id)}</code></p><p>Artifact SHA-256: <code>${sha}</code></p><p><a href="${esc(signed.signedUrl)}">Open your report</a></p><p>The report link is time-limited for security.</p></div><p>The report is evidence-bounded. It does not claim more than the retrieved source supports.</p></body></html>`;
    return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8"}});
  } catch(e) {
    return new Response(`Fulfillment failed: ${String(e).slice(0,500)}`,{status:500});
  }
});
