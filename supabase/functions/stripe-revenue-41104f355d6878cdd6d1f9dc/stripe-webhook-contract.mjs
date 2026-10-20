export function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * Resolve a canonical offer SKU from a Stripe Checkout Session.
 * Order is intentional: URL-bound client_reference_id wins over metadata.
 * The returned value is still checked against the authoritative SKU catalog.
 */
export function resolveStripeSku(session) {
  const metadata = session?.metadata || {};
  const paymentIntentMetadata = session?.payment_intent_data?.metadata || {};
  return firstNonEmptyString([
    session?.client_reference_id,
    metadata.sku_id,
    metadata.sku,
    paymentIntentMetadata.sku_id,
    session?.marketplace_listing_id
  ]);
}

/** Interpret the result of the atomic database claim RPC. */
export function classifyInboxClaim(status) {
  if (status === "CLAIMED") return "PROCESS";
  if (status === "DONE") return "DUPLICATE";
  return "BUSY";
}
