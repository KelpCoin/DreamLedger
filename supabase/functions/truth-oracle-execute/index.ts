import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey);

async function isAuthorized(req: Request) {
  const activationToken = req.headers.get("x-economic-activation-token") || "";
  if (activationToken) {
    const { data } = await db.from("economic_activation_auth").select("token_sha256").eq("singleton", true).maybeSingle();
    if (data?.token_sha256) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(activationToken));
      const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hash === data.token_sha256) return true;
    }
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const apiKey = req.headers.get("apikey") || "";
  // The gateway JWT verifier is disabled for activation-token requests. Do not
  // trust role claims from an unverified JWT; require the configured secret itself.
  return Boolean(serviceKey && (token === serviceKey || apiKey === serviceKey));
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function settlementEvidence() {
  const { data: orders, error: orderError } = await db
    .from("revenue_orders")
    .select("id,stripe_event_id,stripe_checkout_session_id,stripe_payment_intent_id,sku_id,amount_nzd,currency,status,paid_at")
    .eq("status","paid")
    .order("paid_at",{ascending:false})
    .limit(50);
  if(orderError) throw orderError;

  const { data: events, error: eventError } = await db
    .from("economic_events")
    .select("event_id,sku_id,offer_id,amount_nzd,payment_settled,fulfilment_verified,evidence_verified,verification_status,event_timestamp")
    .eq("payment_settled",true)
    .order("event_timestamp",{ascending:false})
    .limit(50);
  if(eventError) throw eventError;

  return {
    authority:"CANONICAL_SETTLEMENT_RECORDS",
    stripe_api_access:false,
    mutation_allowed:false,
    paid_orders:orders||[],
    economic_events:events||[],
    note:"Truth Oracle observes settlement evidence written by the signed commerce webhook. It cannot query or mutate Stripe."
  };
}

async function cubeProposition(body: any) {
  const proposal = body?.proposal || {};
  const cellId = String(body?.cell_id || proposal?.cell_id || "").trim();
  if (!cellId) return j({ error: "cell_id required" },400);

  const signal = proposal?.source_signal || {};
  const signalId = String(signal?.signal_id || "").trim();
  let sourceRow: any = null;
  if (signalId) {
    const { data: source, error: sourceError } = await db
      .from("economic_demand_signals")
      .select("signal_id,source,source_ref,source_url,observed_at,problem_text,extracted_budget,extracted_currency,estimated_value_nzd,extracted_intent,raw_data")
      .eq("signal_id", signalId)
      .maybeSingle();
    if (sourceError) throw sourceError;
    sourceRow = source;
  }

  const isHttpUrl = (value: unknown) =>
    typeof value === "string" && /^https?:\/\//i.test(value.trim());
  const sourceUrl = isHttpUrl(sourceRow?.source_url)
    ? String(sourceRow.source_url).trim()
    : isHttpUrl(sourceRow?.source_ref)
      ? String(sourceRow.source_ref).trim()
      : isHttpUrl(sourceRow?.raw_data?.source_url)
        ? String(sourceRow.raw_data.source_url).trim()
        : null;
  const sourceTimestamp = sourceRow?.observed_at ? new Date(sourceRow.observed_at).toISOString() : null;
  const timestampValid = Boolean(sourceTimestamp && !Number.isNaN(Date.parse(sourceTimestamp)));
  const problemText = String(sourceRow?.problem_text || "").trim();
  const sourceBudget = Number(sourceRow?.extracted_budget);
  const sourceCurrency = String(sourceRow?.extracted_currency || "").trim().toUpperCase();
  const raw = sourceRow?.raw_data || {};
  const budgetSourceVerified = Boolean(
    sourceUrl &&
    Number.isFinite(sourceBudget) &&
    sourceBudget > 0 &&
    sourceCurrency &&
    (
      raw.verified_public_listing === true ||
      String(raw.marketplace || "").toLowerCase() === "upwork" ||
      (String(raw.source || "").toLowerCase() === "upwork" && Number(raw.budget_usd) > 0)
    )
  );
  const buyerRole = String(
    raw.buyer_role ||
    (/upwork/i.test(String(sourceRow?.source || "")) && sourceUrl ? "UPWORK_CLIENT" : "")
  ).trim() || null;
  const offerPriceHypothesis = Number(proposal?.offer_price_hypothesis_nzd);
  const offerPriceHypothesisPresent = Number.isFinite(offerPriceHypothesis) && offerPriceHypothesis > 0;

  const checks = {
    buyer_specific: Boolean(buyerRole && sourceUrl && problemText),
    documented_problem: Boolean(problemText && sourceUrl && timestampValid),
    source_signal_present: Boolean(signalId && sourceRow),
    source_locator_present: Boolean(sourceUrl),
    observation_timestamp: timestampValid,
    deliverable_bounded: Boolean(proposal?.proposed_deliverable),
    fulfillment_bounded: Boolean(proposal?.fulfillment_possibility),
    offer_price_hypothesis_present: offerPriceHypothesisPresent,
    price_observed: budgetSourceVerified
  };
  const passed = Object.values(checks).every(Boolean);
  const verdict = passed ? "VERIFIED" : "NEEDS_EVIDENCE";
  const claimKey = `CUBE-${cellId}-${await sha256(JSON.stringify({proposal,sourceUrl,sourceTimestamp,sourceBudget,sourceCurrency}))}`;
  const claimText = `Internal CUBE proposition readiness check for cell ${cellId}: buyer_role=${String(buyerRole || "UNVERIFIED")}; source_budget=${budgetSourceVerified ? `${sourceBudget} ${sourceCurrency}` : "NOT_OBSERVED"}; offer_price_hypothesis_nzd=${offerPriceHypothesisPresent ? offerPriceHypothesis : "NOT_SPECIFIED"}; problem=${problemText}`;
  const sourceSnapshot = {
    signal_id: signalId || null,
    source: sourceRow?.source || null,
    source_url: sourceUrl,
    source_timestamp: sourceTimestamp,
    problem_text: problemText || null,
    buyer_role: buyerRole,
    extracted_budget: Number.isFinite(sourceBudget) ? sourceBudget : null,
    extracted_currency: sourceCurrency || null,
    budget_source_verified: budgetSourceVerified,
    verified_public_listing: raw.verified_public_listing === true
  };
  const { data: claim, error: claimError } = await db.from("truth_oracle_claims").upsert({
    claim_key:claimKey,subject:"CUBE_PROPOSITION",claim:claimText,claim_type:"ECONOMIC",verdict:"UNVERIFIED",evidence_required:true
  },{onConflict:"claim_key"}).select("id,claim_key,claim").single();
  if (claimError) throw claimError;

  const snapshot = JSON.stringify({
    proposal,source_signal_snapshot:sourceSnapshot,checks,verdict,
    verification_scope:"INTERNAL_PROPOSITION_READINESS",external_economic_truth:false,independent_evidence:false
  });
  const contentHash = await sha256(snapshot);
  const { data: evidence, error: evidenceError } = await db.from("truth_oracle_evidence").insert({
    claim_id:claim.id,evidence_type:"INTERNAL_ARTIFACT",source_name:String(sourceRow?.source || signal?.source || "CUBE"),
    source_url:sourceUrl,source_locator:sourceUrl || signalId || cellId,
    excerpt:String(problemText || proposal?.documented_problem || "").slice(0,4000),
    evidence_summary:`INTERNAL_PROPOSITION_READINESS_ONLY; not independent economic evidence or a verified economic outcome. Checks=${JSON.stringify(checks)}`,
    source_confidence:"LOW",independent:false,retrieved_at:new Date().toISOString(),content_sha256:contentHash,
    metadata:{
      cell_id:cellId,checks,proposal,source_signal_snapshot:sourceSnapshot,
      verification_scope:"INTERNAL_PROPOSITION_READINESS",external_economic_truth:false,independent_evidence:false,
      buyer_budget_observed:budgetSourceVerified,buyer_budget_amount:budgetSourceVerified ? sourceBudget : null,
      buyer_budget_currency:budgetSourceVerified ? sourceCurrency : null,
      offer_price_hypothesis_nzd:offerPriceHypothesisPresent ? offerPriceHypothesis : null
    }
  }).select("id").single();
  if (evidenceError) throw evidenceError;

  const result = {
    contract:"CUBE -> TRUTH_ORACLE -> VERDICT",cell_id:cellId,checks,verdict,evidence_id:evidence.id,evidence_hash:contentHash,
    verification_scope:"INTERNAL_PROPOSITION_READINESS",external_economic_truth:false,independent_evidence:false,
    buyer_budget_observed:budgetSourceVerified,buyer_budget_amount:budgetSourceVerified ? sourceBudget : null,
    buyer_budget_currency:budgetSourceVerified ? sourceCurrency : null,
    offer_price_hypothesis_nzd:offerPriceHypothesisPresent ? offerPriceHypothesis : null
  };
  const resultHash = await sha256(JSON.stringify(result));
  const { data: run, error: runError } = await db.from("truth_oracle_runs").upsert({
    run_key:`cube:${cellId}:${contentHash}`,claim_id:claim.id,proposal:claimText,
    oracle_model:"deterministic-cube-proposition-v2",verdict,confidence:passed ? 0.5 : 0,
    result,evidence_ids:[evidence.id],proposal_sha256:await sha256(claimText),result_sha256:resultHash
  },{onConflict:"run_key"}).select("id,run_key,verdict,evidence_ids,result_sha256,created_at").single();
  if (runError) throw runError;
  await db.from("truth_oracle_claims").update({
    verdict,confidence:passed ? 0.5 : 0,
    oracle_notes:`Internal proposition readiness only. External economic truth and independent evidence remain false. Run ${run.id}.`,
    last_verified_at:new Date().toISOString()
  }).eq("id",claim.id);
  return j({run,claim_id:claim.id,evidence_id:evidence.id,result});
}

async function catalog(body: any) {
  const skuId = String(body.sku_id || "").trim();
  if (!skuId) return j({error:"sku_id required"},400);
  const claimKey = `CATALOG-${skuId}-ACTIVE-PRICE`;
  const claimText = `revenue_catalog contains active SKU ${skuId} with the expected price and configured payment identifiers.`;
  const {data:claim,error:claimError}=await db.from("truth_oracle_claims").upsert({claim_key:claimKey,subject:"REVENUE_CATALOG",claim:claimText,claim_type:"IMPLEMENTATION",verdict:"UNVERIFIED",evidence_required:true},{onConflict:"claim_key"}).select("id,claim_key,claim").single();
  if(claimError)throw claimError;
  const {data:row,error:rowError}=await db.from("revenue_catalog").select("sku_id,name,lane,description,price_nzd,stripe_product_id,stripe_price_id,stripe_payment_link,active,fulfillment_type,created_at,updated_at").eq("sku_id",skuId).maybeSingle();
  if(rowError)throw rowError;
  const expectedPrice=body.expected_price_nzd==null?Number(row?.price_nzd):Number(body.expected_price_nzd);
  const checks={exists:!!row,active:row?.active===true,expected_price_nzd:Number.isFinite(expectedPrice),price_matches:!!row&&Number(row.price_nzd)===expectedPrice,stripe_product_configured:!!row?.stripe_product_id,stripe_price_configured:!!row?.stripe_price_id,payment_link_configured:!!row?.stripe_payment_link,fulfillment_configured:!!row?.fulfillment_type};
  const passed=Object.values(checks).every(Boolean);
  const snapshot=row?JSON.stringify(row):JSON.stringify({sku_id:skuId,missing:true});
  const contentHash=await sha256(snapshot);
  const {data:evidence,error:evidenceError}=await db.from("truth_oracle_evidence").insert({claim_id:claim.id,evidence_type:"RUNTIME_PROOF",source_name:"public.revenue_catalog",source_locator:`sku_id=${skuId}`,evidence_summary:`Authoritative revenue_catalog snapshot for ${skuId}; deterministic checks=${JSON.stringify(checks)}`,source_confidence:"HIGH",independent:true,retrieved_at:new Date().toISOString(),content_sha256:contentHash,metadata:{checks,sku_id:skuId,expected_price_nzd:expectedPrice,snapshot}}).select("id").single();
  if(evidenceError)throw evidenceError;
  const result={contract:"DETERMINISTIC_PROOF -> EVIDENCE_AGGREGATION -> VERDICT",sku_id:skuId,checks,verdict:passed?"VERIFIED":"CONTRADICTED",evidence_id:evidence.id,source:"public.revenue_catalog",evidence_hash:contentHash};
  const resultHash=await sha256(JSON.stringify(result));
  const {data:run,error:runError}=await db.from("truth_oracle_runs").upsert({run_key:`oracle:${skuId}:${contentHash}`,claim_id:claim.id,proposal:claimText,oracle_model:"deterministic-supabase-v2",verdict:result.verdict,confidence:passed?1:0,result,evidence_ids:[evidence.id],proposal_sha256:await sha256(claimText),result_sha256:resultHash},{onConflict:"run_key"}).select("id,run_key,verdict,evidence_ids,result_sha256,created_at").single();
  if(runError)throw runError;
  await db.from("truth_oracle_claims").update({verdict:result.verdict,confidence:passed?1:0,oracle_notes:`Run ${run.id}; deterministic catalog checks executed against authoritative database row.`,last_verified_at:new Date().toISOString()}).eq("id",claim.id);
  return j({run,claim_id:claim.id,evidence_id:evidence.id,result});
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return j({error:"POST required"},405);
    if (!(await isAuthorized(req))) return j({error:"service_role required"},403);
    const body = await req.json();
    if (body?.mode === "STRIPE_SETTLEMENT") {
      return j({ settlement: await settlementEvidence() });
    }
    if (body?.mode === "CUBE_PROPOSITION") return await cubeProposition(body);
    return await catalog(body);
  } catch (e) {
    return j({error:e instanceof Error?e.message:JSON.stringify(e)},500);
  }
});