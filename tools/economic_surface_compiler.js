#!/usr/bin/env node
/*
DreamLedger Economic Surface Compiler
Read-only commercial compilation. It discovers economically addressable surfaces
from observed substrate. It does not create products, infer revenue, mutate Stripe,
contact buyers, or promote candidates to VERIFIED truth.

Usage:
  node tools/economic_surface_compiler.js \
    --inventory runtime/cube/service_surface_monetization_inventory_2026-10-04.json \
    --output runtime/cube/economic_surface_map.json
*/

const fs = require("fs");
const crypto = require("crypto");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}
function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}
function has(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}
function truth(v) {
  return v === true;
}

const input = arg("--inventory", "runtime/cube/service_surface_monetization_inventory_2026-10-04.json");
const output = arg("--output", "runtime/cube/economic_surface_map.json");
const raw = fs.readFileSync(input, "utf8");
const inventory = JSON.parse(raw);
const services = Array.isArray(inventory.services) ? inventory.services : [];

function observedScore(s) {
  const payment = has(s.payment_path) ? 1 : 0;
  const wall = has(s.service_wall) ? 1 : 0;
  const fulfillment = has(s.existing_fulfillment) ? 1 : 0;
  const delivery = has(s.deliverable) ? 1 : 0;
  const automation = truth(s.automated_delivery_allowed) ? 1 : 0;
  const noHuman = s.human_gate_required === false ? 1 : 0;
  const owner = n(s.owner_minutes, 999);
  const attention = owner === 0 ? 1 : owner < 15 ? 0.7 : 0.2;
  const blocker = String(s.current_blocker || "").toLowerCase();
  const blocked = /not observed|not fully|manual|unknown|no observed/.test(blocker) ? 0 : 1;
  return Number(((payment + wall + fulfillment + delivery + automation + noHuman + attention + blocked) / 8 * 100).toFixed(2));
}

function evidenceClass(s) {
  const status = String(s.status || "").toUpperCase();
  if (status === "READY_FOR_SERVICE" || status === "READY_FOR_DELIVERY") return "OBSERVED_READY";
  if (status === "UNPROVEN") return "OBSERVED_INCOMPLETE";
  if (status === "AUTHORITY_BLOCKED" || status === "BLOCKED") return "OBSERVED_BLOCKED";
  return "OBSERVED";
}

function shapes(s) {
  const shapes = ["ONE_OFF"];
  if (String(s.repeatability || "").toLowerCase().includes("subscription")) shapes.push("RECURRING");
  if (n(s.owner_minutes, 999) === 0 && truth(s.automated_delivery_allowed)) shapes.push("USAGE");
  if (has(s.existing_endpoint)) shapes.push("API_ACCESS");
  if (has(s.service_wall) && has(s.entitlement_path)) shapes.push("PRIVATE_ACCESS");
  if (has(s.existing_fulfillment) && truth(s.automated_delivery_allowed)) shapes.push("MANAGED_SERVICE");
  return [...new Set(shapes)];
}

function priceBasis(s) {
  const value = String(s.estimated_customer_value || "");
  const m = value.match(/(?:NZ\$|NZD\s*)[0-9][0-9,]*(?:\.[0-9]+)?/i);
  return m ? m[0] : "UNPRICED";
}

const compiled = services.map((s) => {
  const score = observedScore(s);
  const evidence = evidenceClass(s);
  const basis = priceBasis(s);
  return {
    surface_id: "SURFACE-" + String(s.service_id || s.capability_id || "UNKNOWN").replace(/[^A-Za-z0-9]+/g, "-").toUpperCase(),
    source_service_id: s.service_id || null,
    capability_id: s.capability_id || null,
    customer_problem: s.customer_problem || null,
    buyer_class: s.buyer_class || null,
    substrate: s.existing_substrate || [],
    endpoint: s.existing_endpoint || null,
    service_wall: s.service_wall || null,
    payment_path: s.payment_path || null,
    fulfillment: s.existing_fulfillment || null,
    delivery: s.deliverable || null,
    proof: s.existing_evidence || null,
    human_gate_required: s.human_gate_required ?? null,
    owner_minutes: n(s.owner_minutes, null),
    observed_price_basis: basis,
    price_expansion_status: basis === "UNPRICED" ? "UNPRICED_REQUIRES_EXTERNAL_EVIDENCE" : "OBSERVED_ONLY",
    commercial_shapes: shapes(s),
    evidence_class: evidence,
    substrate_leverage_score: score,
    promotion_state: "CANDIDATE_ONLY",
    truth_state: "UNVERIFIED",
    explicit_rule: "No candidate, price expansion, buyer, payment, or outcome is treated as verified without external evidence."
  };
}).sort((a,b) => b.substrate_leverage_score - a.substrate_leverage_score);

const groups = new Map();
for (const s of compiled) {
  const k = s.capability_id || "UNKNOWN";
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(s.surface_id);
}

const portfolioFamilies = [...groups.entries()].map(([capability_id, surface_ids]) => ({
  capability_id,
  surface_ids,
  family_state: "OBSERVED_CAPABILITY_FAMILY",
  expansion_rule: "Compile only from observed substrate; pricing and buyer demand require external evidence."
}));

const result = {
  schema: "dreamledger/economic-surface-map/v1",
  compiler: "tools/economic_surface_compiler.js",
  compiler_version: "1.0.0",
  generated_at: new Date().toISOString(),
  source: input,
  source_sha256: sha256(raw),
  repository_truth: {
    verified_external_revenue: "NZ$0.00",
    settled_external_payments: 0,
    independent_external_buyers: 0,
    verified_economic_outcomes: 0
  },
  counts: {
    observed_services: services.length,
    capability_families: portfolioFamilies.length,
    ready_or_delivery_ready: compiled.filter(x => x.evidence_class === "OBSERVED_READY").length,
    incomplete: compiled.filter(x => x.evidence_class === "OBSERVED_INCOMPLETE").length,
    blocked: compiled.filter(x => x.evidence_class === "OBSERVED_BLOCKED").length
  },
  portfolio_families: portfolioFamilies,
  ranked_surfaces: compiled,
  prohibited_inferences: [
    "A surface is not revenue.",
    "A payment path is not a settled payment.",
    "A checkout or entitlement is not a buyer.",
    "A listed price is not willingness to pay.",
    "A route or silo is not an independent business.",
    "A model output or internal evidence row is not external proof."
  ]
};

fs.mkdirSync(require("path").dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  ok: true,
  schema: result.schema,
  source_sha256: result.source_sha256,
  observed_services: result.counts.observed_services,
  capability_families: result.counts.capability_families,
  top_surfaces: compiled.slice(0, 10).map(x => ({
    surface_id: x.surface_id,
    score: x.substrate_leverage_score,
    state: x.evidence_class,
    price_basis: x.observed_price_basis
  })),
  truth: result.repository_truth,
  output
}, null, 2));
