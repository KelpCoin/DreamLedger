# Commander Diagnostic webhook and SKU repair

Status: REVIEW REQUIRED / PRODUCTION HOLD. This branch is not deployed.

## Canonical ownership

`stripe-revenue-41104f355d6878cdd6d1f9dc` remains the only owner of the marketplace settlement path. Its signature must validate before its side effects, including `marketplace_settle_stripe_payment`.

The canonical handler now reads only `STRIPE_WEBHOOK_SIGNING_SECRET`. It intentionally does not reuse the generic `STRIPE_WEBHOOK_SECRET` as a fallback: a secret being present is not proof that it matches the canonical Stripe endpoint.

The GET health response distinguishes:
- `stripe_webhook_signing_secret`: canonical secret variable present
- `legacy_webhook_secret_present`: legacy variable present
- `stripe_api_key`: Stripe API key present

These are presence checks only, not cryptographic endpoint-match checks.

## SKU contract

| Boundary | Value |
| --- | --- |
| Public Payment Link SKU | `CMD-DIAG-29` |
| Internal marketplace fulfillment SKU | `COMMANDER-DECK-DIAGNOSTIC-001` |
| Mapping point | `marketplace-diagnostic-input` |
| Fulfillment lookup | Session ID + normalized internal SKU |

The public Payment Link metadata and URL remain unchanged. The intake endpoint translates the public SKU to the internal SKU before looking up the fulfillment record. Intake requires a live-mode, paid Checkout Session.

## Stripe routing observed during audit

- Canonical settlement endpoint ID: `we_1UDJ6DEGgEAnUFF9Zgzefuzr`, currently disabled.
- The enabled `dreamledger-stripe-webhook-v2` endpoint targets a quarantined handler that returns `503 WEBHOOK_QUARANTINED`.
- `dreamledger-stripe-webhook-v3` verifies signatures and records observations, but it is not the settlement owner.
- Commander Payment Link `plink_1UKS00EGgEAnUFF9kUjraaL5` remains inactive.

## Required rollout gates

1. Review and merge this code only after the contract test passes.
2. Deploy function source without activating the Commander Payment Link.
3. In Stripe Dashboard, rotate or identify the signing secret for the canonical endpoint. Store that endpoint's secret as `STRIPE_WEBHOOK_SIGNING_SECRET` in Supabase. Do not store it in Git or chat.
4. Confirm the canonical health response reports `stripe_webhook_signing_secret: true`. That proves presence only.
5. Verify the endpoint-specific signing secret with a Stripe-signed endpoint test and confirm the response status and delivery attempt in Stripe Dashboard. A generic `true` flag alone does not prove the match.
6. Keep canonical endpoint disabled until source, secret name, and test plan are approved. Then enable only the canonical settlement owner; do not route this offer to v2 or v3.
7. Run a controlled test-environment end-to-end order and verify settlement RPC, normalized SKU lookup, decklist intake, and delivery evidence. Do not count a test as revenue.
8. Only after all gates pass, explicitly authorize activation of the live Payment Link.

## Economic truth

No Stripe endpoint was changed and no function was deployed by this branch creation. Commerce stays HOLD and verified revenue remains NZ$0.00 until a real external live payment is settled, attributed, fulfilled, and delivered with evidence.
