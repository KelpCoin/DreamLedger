import { createHash } from "node:crypto";

const DAY_MS = 86400000;
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function fail(code, reason) { return { decision: "BLOCK", code, reason }; }

/** Deterministic, non-binding pre-screen. Not trade execution or financial advice. */
export function evaluatePair(a, b, { now = new Date().toISOString(), maxEvidenceAgeDays = 365 } = {}) {
  if (!a || !b || a.intent_id === b.intent_id) return fail("INVALID_PAIR", "Two distinct intents are required.");
  if (!["BUY_FORWARD", "SELL_FORWARD"].includes(a.side) || !["BUY_FORWARD", "SELL_FORWARD"].includes(b.side) || a.side === b.side)
    return fail("SIDE_MISMATCH", "A buyer intent and a seller intent are required.");
  for (const x of [a, b]) {
    if (x.consent?.data_processing !== true || x.consent?.matching_only !== true || x.consent?.revoked === true || x.consent?.revoked_at)
      return fail("CONSENT_BLOCKED", "Consent is absent, false, or revoked.");
    if (!Array.isArray(x.evidence) || x.evidence.length === 0) return fail("EVIDENCE_MISSING", "Evidence is required.");
    for (const e of x.evidence) {
      if (e.verification_status !== "VERIFIED") return fail("EVIDENCE_NOT_VERIFIED", "Every evidence item must be independently verified.");
      if (!e.verified_at) return fail("EVIDENCE_TIMESTAMP_MISSING", "Verified evidence requires verified_at.");
      const age = Date.parse(now) - Date.parse(e.verified_at);
      if (!Number.isFinite(age) || age < 0 || age > maxEvidenceAgeDays * DAY_MS)
        return fail("EVIDENCE_STALE", "Evidence timestamp is invalid, future-dated, or stale.");
    }
    const w = x.delivery_window;
    if (!w?.start_date || !w?.end_date || w.start_date > w.end_date) return fail("DELIVERY_WINDOW_INVALID", "Delivery window is invalid.");
    if (!(Number(x.quantity_nzu) > 0)) return fail("QUANTITY_INVALID", "Quantity must be positive.");
    if (x.price_basis?.currency !== "NZD" || x.price_basis?.unit !== "NZU") return fail("PRICE_BASIS_UNSUPPORTED", "Only NZD per NZU is supported.");
  }
  const start = a.delivery_window.start_date > b.delivery_window.start_date ? a.delivery_window.start_date : b.delivery_window.start_date;
  const end = a.delivery_window.end_date < b.delivery_window.end_date ? a.delivery_window.end_date : b.delivery_window.end_date;
  if (start > end) return fail("DELIVERY_WINDOW_MISMATCH", "Delivery windows do not overlap.");
  let price;
  if (a.price_basis.kind === "FIXED" && b.price_basis.kind === "FIXED") {
    if (Number(a.price_basis.price_per_nzu) !== Number(b.price_basis.price_per_nzu)) return fail("PRICE_MISMATCH", "Fixed prices differ.");
    price = Number(a.price_basis.price_per_nzu);
  } else return fail("PRICE_REVIEW_REQUIRED", "Index-linked or negotiable prices require human review.");
  const quantity = Math.min(Number(a.quantity_nzu), Number(b.quantity_nzu));
  const ids = [a.intent_id, b.intent_id].sort();
  const payload = JSON.stringify({ version: 1, intent_ids: ids, delivery: { start, end }, quantity_nzu: quantity, price_per_nzu: price });
  const match_id = "cfm_" + createHash("sha256").update(payload).digest("hex");
  return { decision: "MATCH_PROPOSED", binding: false, requires_human_review: true, match_id,
    terms: { delivery_start: start, delivery_end: end, quantity_nzu: quantity, price_per_nzu: price, currency: "NZD", unit: "NZU" },
    warning: "Pre-screen only. No trade, title, eligibility, counterparty authority, or settlement is established." };
}
