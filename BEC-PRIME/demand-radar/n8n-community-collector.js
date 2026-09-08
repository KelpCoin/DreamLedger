const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_ID = "SRC-N8N";
const SOURCE = "n8n_community";
const ENDPOINT = "https://community.n8n.io/c/jobs/13.json?page=1";

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const sleep = ms => new Promise(r => setTimeout(r, ms));

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractBudget(text) {
  const m = String(text || "").match(/(?:NZ\$|US\$|AU\$|CA\$|\$|USD\s*)\s*(\d{2,6}(?:[,.]\d{1,2})?)/i);
  return m ? Number(m[1].replace(",", "")) : null;
}

function scoreIntent(text) {
  const s = String(text || "").toLowerCase();
  let score = 0;
  if (/\b(paid|pay|budget|compensation|hire|hiring|freelancer|contractor)\b/.test(s)) score += 0.35;
  if (/\b(urgent|asap|immediately|broken|stopped|losing|ghosted|deadline)\b/.test(s)) score += 0.25;
  if (/\b(need|looking for|seeking|required|help)\b/.test(s)) score += 0.20;
  if (/\b(n8n|automation|workflow|ai agent|api integration)\b/.test(s)) score += 0.20;
  return Math.min(1, score);
}

function domainFor(text) {
  const s = String(text || "").toLowerCase();
  if (/discord/.test(s)) return "discord_communities";
  if (/crm|hubspot|salesforce/.test(s)) return "crm_operations";
  if (/lead|pipeline|prospect/.test(s)) return "lead_generation";
  if (/webhook/.test(s)) return "webhooks";
  if (/api|integration/.test(s)) return "api_integrations";
  if (/email|gmail|outlook/.test(s)) return "email_operations";
  if (/saas/.test(s)) return "saas_stacks";
  if (/e-?commerce|shopify|woocommerce/.test(s)) return "ecommerce";
  if (/document|pdf|ocr/.test(s)) return "document_processing";
  return "ai_workflows";
}

async function supabase(path, options = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + await res.text());
  return res.status === 204 ? null : res.json();
}

async function main() {
  const response = await fetch(ENDPOINT, {
    headers: { "User-Agent": "BrownEye-DemandRadar/1.0 (read-only)" }
  });
  if (!response.ok) throw new Error("n8n Community " + response.status);
  const payload = await response.json();
  const topics = payload.topic_list?.topics || [];

  let inserted = 0;

  for (const topic of topics.slice(0, 50)) {
    const title = stripHtml(topic.title);
    const url = "https://community.n8n.io/t/" + topic.slug + "/" + topic.id;
    const text = title;
    const intent = scoreIntent(text);

    const signal = {
      signal_id: "N8N-" + topic.id,
      source: SOURCE,
      source_url: url,
      title,
      body: text,
      problem_text: text,
      raw_data: topic,
      extracted_budget: extractBudget(text),
      extracted_currency: /NZ\$/.test(text) ? "NZD" : /AU\$/.test(text) ? "AUD" : /CA\$/.test(text) ? "CAD" : "USD",
      extracted_intent: intent >= 0.7 ? "HIGH" : intent >= 0.4 ? "MEDIUM" : "LOW",
      domain_id: domainFor(text),
      buyer_intent: intent,
      freshness_score: 1,
      evidence_score: 0.75,
      fit_score: 0.75,
      silo_id: "SILO_GENERAL",
      status: "UNROUTED",
      approval_required: true,
      observed_at: new Date(topic.bumped_at || topic.created_at || Date.now()).toISOString()
    };

    await supabase("/rest/v1/economic_demand_signals?on_conflict=source,source_url", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(signal)
    });
    await supabase("/rest/v1/rpc/route_economic_demand", {
      method: "POST",
      body: JSON.stringify({ p_signal_id: signal.signal_id })
    });
    inserted++;
    await sleep(100);
  }

  await supabase("/rest/v1/economic_demand_sources?source_id=eq." + encodeURIComponent(SOURCE_ID), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      last_scan_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      signal_count: inserted
    })
  });

  console.log(JSON.stringify({
    source: SOURCE_ID,
    endpoint: ENDPOINT,
    topics_seen: topics.length,
    inserted,
    public_actions: 0,
    approval_required: true
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
