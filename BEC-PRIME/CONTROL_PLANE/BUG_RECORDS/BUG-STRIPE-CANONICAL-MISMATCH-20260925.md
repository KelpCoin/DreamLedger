# BUG-STRIPE-CANONICAL-MISMATCH-20260925

Status: REPAIR_APPLIED_PENDING_WORKFLOW_VERIFICATION
Observed: 2026-09-25 NZST

## Symptom
The connected Stripe account is live account acct_1SNVPvEGgEAnUFF9, while Economic Loop Controller V2 and BEC Prime Revenue Loop contained the stale account acct_1NKPLaJt4ieIQDFz. Revenue Loop also contained a stale CMD-DIAG payment-link URL and an offer-id predicate that did not match the active Stripe metadata.

## Evidence
- Connected Stripe live account: acct_1SNVPvEGgEAnUFF9.
- Active CMD-DIAG payment link: plink_1UFFZFEGgEAnUFF9LHNMWTDl / https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I.
- Active CMD-DIAG Stripe metadata includes product COMMANDER-DECK-DIAGNOSTIC-001 and offer_id MTG_CMD_DIAG_001.
- economic_outcomes: 0.
- revenue_orders: 0.
- fulfillment_requests: 0.
- first_payment_proofs: 0.
- Verified external revenue: NZ$0.

## Broken contract
Every production revenue verifier must target the currently connected live Stripe account and the currently approved production checkout identity, or a real payment can be missed or misattributed.

## Ten repairs
1. Correct stale account, payment-link and identity constants directly. Lowest complexity and immediately reversible.
2. Remove duplicate controller V2 and retain one canonical controller. Reduces drift surface but is broader.
3. Load canonical offer identity from approved.json at workflow runtime. Stronger drift resistance.
4. Discover the active payment link from Stripe metadata at runtime. Better provider alignment but more runtime ambiguity.
5. Create one shared commerce manifest consumed by every verifier. Centralizes identity but adds another file.
6. Make Stripe metadata the sole canonical identity. Simpler provider lookup but weakens internal governance.
7. Make Supabase revenue_catalog the sole canonical identity. Centralizes DB state but adds another drift boundary.
8. Add a scheduled Stripe drift detector. Detects mismatch without repairing it.
9. Add CI invariants rejecting stale Stripe IDs and payment links. Prevents recurrence cheaply.
10. Replace polling recognition with webhook-only recognition. Strong event semantics but much broader scope.

## Selected repair
Path 1 now. Path 9 remains the follow-on hardening candidate.

Reason: smallest reversible repair that removes a known false-negative gate without redesigning commerce.

## Applied
- V2 account ID corrected to acct_1SNVPvEGgEAnUFF9.
- Revenue Loop account ID corrected to acct_1SNVPvEGgEAnUFF9.
- Revenue Loop CMD-DIAG payment-link URL corrected to the active link.
- Revenue Loop paid-session matching no longer requires the stale offer_id predicate and derives the observed offer ID from live Stripe metadata while still requiring the canonical product identity, amount, currency and payment link.

## Economic state
VERIFIED_EXTERNAL_REVENUE = NZ$0
SETTLED_EXTERNAL_PAYMENTS = 0
FULFILLMENT_REQUESTS = 0
FIRST_PAYMENT_PROOFS = 0

## Remaining blocker
An actual external buyer has not paid. The prepared public reply in approval_queue remains human-gated.

## Next transition
Run the repaired verification path and inspect the result. Then harden against identifier drift.
