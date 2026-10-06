import crypto from "node:crypto";
import canonicalize from "canonicalize";

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
function canonicalHash(value) {
  const canonical = canonicalize(value);
  if (canonical === undefined) throw new Error("CANONICALIZATION_FAILED");
  return sha256(canonical);
}
function normalizeQuote(q) {
  if (!q || typeof q !== "object") throw new Error("INVALID_QUOTE");
  if (typeof q.supplier !== "string" || !q.supplier.trim()) throw new Error("INVALID_SUPPLIER");
  if (typeof q.amount !== "number" || !Number.isFinite(q.amount) || q.amount < 0) throw new Error("INVALID_AMOUNT");
  if (typeof q.currency !== "string" || !q.currency.trim()) throw new Error("INVALID_CURRENCY");
  if (!Array.isArray(q.line_items)) throw new Error("INVALID_LINE_ITEMS");
  if (typeof q.timestamp !== "string" || !q.timestamp.trim()) throw new Error("INVALID_TIMESTAMP");
  return {supplier:q.supplier,amount:q.amount,currency:q.currency,line_items:q.line_items,timestamp:q.timestamp};
}
export function verifyQuoteComparison(input) {
  const quotes = Array.isArray(input?.quotes) ? input.quotes.map(normalizeQuote) : [];
  const claimed = input?.claimed_comparison && typeof input.claimed_comparison === "object" ? input.claimed_comparison : {};
  const evidence = {quotes,claimed_comparison:claimed};
  const evidence_hash = canonicalHash(evidence);
  if (quotes.length < 2) {
    const receipt = {status:"INSUFFICIENT_DATA",claimed_cheapest:claimed.cheapest ?? "unknown",actual_cheapest:"",deviation:0,reason:"Need at least two quotes to compare.",evidence_hash};
    return {...receipt,receipt_hash:canonicalHash(receipt),evidence_hash};
  }
  const currencies = new Set(quotes.map(q=>q.currency.toUpperCase()));
  if (currencies.size !== 1) {
    const receipt = {status:"INSUFFICIENT_DATA",claimed_cheapest:claimed.cheapest ?? "",actual_cheapest:"",deviation:0,reason:"Quotes use different currencies and no FX normalization was supplied.",evidence_hash};
    return {...receipt,receipt_hash:canonicalHash(receipt),evidence_hash};
  }
  const sorted = [...quotes].sort((a,b)=>a.amount-b.amount || a.supplier.localeCompare(b.supplier));
  const actual_cheapest = sorted[0].supplier;
  const claimed_cheapest = typeof claimed.cheapest === "string" ? claimed.cheapest : "";
  const claimedQuote = quotes.find(q=>q.supplier===claimed_cheapest);
  const minimum = sorted[0].amount;
  const deviation = claimedQuote && minimum > 0 ? Number(((claimedQuote.amount-minimum)/minimum).toFixed(6)) : 0;
  const status = claimed_cheapest===actual_cheapest ? "VERIFIED" : "CONTRADICTED";
  const reason = status==="VERIFIED" ? "Claimed cheapest matches deterministic minimum." : "Claimed cheapest was '" + claimed_cheapest + "' but deterministic minimum is '" + actual_cheapest + "'.";
  const receipt = {status,claimed_cheapest,actual_cheapest,deviation,reason,evidence_hash};
  return {...receipt,receipt_hash:canonicalHash(receipt),evidence_hash};
}
export {canonicalHash};
