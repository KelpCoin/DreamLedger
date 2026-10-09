# Commerce Graph Adapter: normalized offer contract

Status: DESIGN COMPONENT. No provider integration or live commerce action is implied.

## Purpose
Use one normalized, evidence-labelled offer envelope across provider adapters. The contract supports free B2B comparison and low-cost authenticated A2A calls without requiring every consumer to implement a bespoke parser for each provider.

Schema: [commerce-offer.v1.schema.json](./commerce-offer.v1.schema.json)

## Contract rules
- A listing, quote, affiliate claim, click, checkout session, purchase, and settled transaction are different evidence classes.
- Unknown shipping, tax, stock, or returns data stays explicitly unknown. Do not substitute zero.
- Compare offers only when currency, variant, quantity/unit, and total-cost basis are compatible. Otherwise return a reason-coded incomparable result.
- Vendor-reported catalog counts, conversion uplifts, and commission rates remain VENDOR_CLAIM until independently corroborated.
- Source URL, observation time, and optional SHA-256 digest travel with the normalized offer.
- Keep credentials, buyer/seller personal data, private supplier quotes, licensed raw catalogs, and signed URLs out of public observations.
- Attribution eligibility is not a confirmed commission; confirmed commission is not settled revenue.
- The contract is provider-neutral. Do not imply REVERSIBLE, a retailer, or any other provider exposes fields that have not been verified in its authorized documentation.

## Deterministic comparison acceptance
1. Identical normalized inputs produce the same ranking and result digest.
2. Currency mismatch blocks total-cost ranking unless a versioned FX conversion and timestamp are supplied.
3. Missing shipping/tax remains UNKNOWN and cannot be treated as free.
4. Different size, model, quantity, SKU, or GTIN is not an exact match without an explicit equivalence rule.
5. Stale availability is flagged; it is not promoted to current stock.
6. Vendor-reported commission rates retain VENDOR_CLAIM provenance.
7. TEST/SIMULATED/INTERNAL evidence never satisfies an external settlement gate.
8. No private or licensed data is republished without authorization.
9. No external purchase, affiliate link generation, counterparty contact, or spend occurs merely because a comparison ranked an offer.

## Integration order
1. Add positive/negative schema fixtures.
2. Inspect the existing AgentBridge request/receipt contract and CUBE/public.jobs worker envelope.
3. Implement a pure normalization/comparison function with reason codes and an idempotency digest.
4. Route a read-only synthetic fixture through existing AgentBridge/CUBE; do not create a second queue.
5. Add a provider adapter only after terms, API access, attribution rules and data rights are verified.
6. Keep checkout, entitlement, fulfillment and truth reconciliation on existing DreamLedger rails.

## Monetization path
Free B2B discovery/comparison is the acquisition surface. Cheap A2A calls use the existing AgentBridge toll/key rail. Monetize authenticated usage, verified fulfillment and optional value-added capabilities only when the rail works end-to-end. Do not invent a new SKU based on this schema.

## Truth boundary
A normalized offer is not a sale. A click is not a sale. A checkout session is not a settlement. Verified external revenue requires an independent buyer, settled payment, fulfillment and independent evidence.
