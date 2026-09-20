# ECONOMIC CONTROL HANDOFF — 2026-09-20

## Bottom line

Verified external revenue: NZ$0.

The main problem is no longer a missing payment rail. The main problem is that no real external buyer has completed the transaction.

## Production findings

Supabase DreamLedger is ACTIVE_HEALTHY.

CMD-DIAG-29 exists as an active NZ$29 revenue_catalog entry with live Payment Link:
https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I

The canonical Stripe handler is stripe-revenue-41104f355d6878cdd6d1f9dc v17.

The canonical settlement RPC is marketplace_settle_stripe_payment.

Do not add another marketplace_fulfillments writer.

Current revenue_orders for COMMANDER-DECK-DIAGNOSTIC-001: 0.
Current marketplace_fulfillments: 0.
Verified external revenue: NZ$0.

## Newly identified control-plane issues

1. revenue_catalog contains both:
   - CMD-DIAG-29: NZ$29, digital
   - COMMANDER-DECK-DIAGNOSTIC-001: NZ$15, manual_pdf

   The NZ$15 entry is an active legacy duplicate SKU and should not be allowed to create ambiguity in future acquisition or reconciliation.

2. commerce-supervisor v1 is ACTIVE, but commerce_cells currently contains the billboard and Maximona cells, not CMD-DIAG-29. Therefore the supervisor is not currently the authoritative monitor for the CMD-DIAG commerce cell.

Neither issue justifies breaking the proven payment path.

## Shallows browser blocker

The standalone HTML contains two confirmed portability problems:
- an invalid emoji corruption in a bit-shift expression if the literal `>> 😎` is present; it must be `>> 8`
- Claude Artifact-specific `window.storage`, which is unavailable in ordinary standalone browsers and should be replaced with standard `localStorage`

Fix and test those before investigating CORS.

## Why this is not money yet

The system has accumulated potential energy: code, payment links, RPCs, bridge state, docs and offers.

It has not accumulated economic evidence.

The missing transition is:

real buyer -> real action -> settled payment -> attribution -> fulfillment -> delivery -> proof.

More architecture cannot substitute for that transition.

## Execution rule

Freeze proven settlement infrastructure.

Finish only the minimum customer-path fixes.

Verify the public CTA.

Then use a human-approved existing acquisition surface to expose one existing offer to a real buyer.

The next meaningful system change is a settled external payment, not another document or feature.
