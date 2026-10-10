# Marketplace production-readiness gate

This gate supplements static UI checks. It is not a production certification.

## A2A checkout handoff

- Configure `M2M_QUOTE_SIGNING_SECRET` as a high-entropy secret in the deployed Render service. Do not commit it or expose it to browser code.
- Without that secret, quote requests return HTTP 503; authorization requires a verified user first and then fails with HTTP 503. Neither path may create a checkout session.
- Quotes are HMAC-signed over product ID, current price, currency, and issue time. Authorization rejects altered, mismatched, or expired quotes (15-minute maximum).
- The browser must display the quoted price, require an explicit confirmation, and use a verified Supabase Auth session for the authorization request.
- The UI now calls `/api/a2a/checkout`, which deliberately returns `A2A_ORDER_RAIL_NOT_RELEASED`. Do not replace this fail-closed gate with the generic `/api/checkout/create` route until checkout creates an order in the canonical marketplace model and settlement/fulfillment are wired and tested.
- A checkout session is not a payment. A payment is not verified revenue until the signed webhook, durable order, entitlement, fulfillment, delivery evidence, and independent settlement proof agree.

## Release blockers while Supabase SQL is unavailable

- B2B RFQs/offers have a new migration and Supabase-backed API in the draft PR, but the migration is not applied and the SQL data plane is unreachable. Do not claim those routes are operational until migration and authenticated API tests pass.
- B2B order acceptance is deliberately disabled. A2A checkout is deliberately disabled. Do not create a second order/payment ledger to work around the unavailable canonical schema.
- Do not merge or promote the marketplace transaction path until the canonical Supabase data plane is reachable and existing tables/RLS policies have been inspected.
- Before production promotion, prove webhook concurrency/idempotency, inventory reservation, refund/dispute state transitions, seller payout gating, RLS isolation, authorization scope, and fulfillment retries with automated tests.
- Keep the supplier quote-comparison worksheet free. Do not re-advertise the retired NZ$49 offer.
- Keep x402 mainnet settlement disabled until the payee, asset allowlist, spend limits, replay controls, and settlement verification are independently tested.

## Current status

Code and static contract checks can be reviewed in the PR. The B2B and A2A contract workflows are configured, but a queued workflow is not a passing test. This document does not assert that secrets are configured, Supabase is healthy, Stripe events have been processed, or a live marketplace transaction has succeeded.


## First-dollar incident response update — 2026-10-10

- **Legacy quote Payment Links:** three active NZ$49 links were found and deactivated: `plink_1UKq77EGgEAnUFF9KOr1SuUY` (canonical SKU metadata), `plink_1UOFT2EGgEAnUFF9JGLisY5s` (only `dreamledger_sku`, which the deployed revenue resolver did not accept by itself), and `plink_1UKqi4EGgEAnUFF9E11kGYWa` (construction SKU but the same quote-intake destination, which would reject that link/SKU combination). All now display an inactive message pointing to the free worksheet. A second live scan of 180 active Payment Links found no remaining quote-comparison links.
- **Remaining open sessions:** 10 open, unpaid Checkout Sessions remain across the first two retired links (9 + 1); the construction link has zero open sessions. Deactivating a Payment Link does not expire its existing Checkout Sessions, and the connected Stripe API interface did not expose the Checkout Session expire operation. They are not revenue.
- **Public route:** public/buy/quote_compare_49/index.html now redirects to /quote-comparison/ on the marketplace PR branch. It is not yet deployed to production; until that change is released, the existing public route may still lead to the deactivated link.
- **Webhook source hardening on the PR branch:** added an atomic claim_stripe_webhook_event RPC migration with a five-minute processing lease; unique indexes for event IDs, Checkout Session IDs, one entitlement per order, and one fulfillment request per entitlement; SKU metadata alias resolution; cents-preserving NZD amounts; session-based order recovery; and delayed-payment settlement handling.
- **Quote-intake startup guard on the PR branch:** changed Stripe initialization so a missing secret does not crash the Edge Function during module load; requests now fail with a clear service-not-configured response. The deployed quote-intake function remains version 2 with the unguarded constructor, and no secret change or deployment was made. The guard is not a substitute for configuring the correct Stripe secret.
- **Database dependency:** the migration has not been applied. The Supabase control plane reports ACTIVE_HEALTHY, but the direct SQL probe did not return a database result and the log API returned a backend error. Do not deploy the modified webhook until the data plane is reachable, the migration preflight passes, and duplicate-key constraints are confirmed.
- **Live webhook topology:** a read-only Stripe audit found 7 endpoints. The canonical `stripe-revenue-41104f355d6878cdd6d1f9dc` endpoint (`we_1UDJ6DEGgEAnUFF9Zgzefuzr`) is disabled; the enabled `dreamledger-stripe-webhook-v2` endpoint (`we_1U74ZtEGgEAnUFF9zjOqs2lZ`) has a hardcoded signing secret in its deployed function source and does not write canonical revenue orders/entitlements. A request to disable that endpoint through the connected Stripe API tool was blocked; no endpoint was disabled or secret rotated. Treat this as an owner action: disable the exposed legacy endpoint and rotate its signing secret before any re-enable. Do not enable the canonical revenue endpoint until PostgreSQL is healthy and the migration/test gate passes.
- **Economic truth remains:** verified external revenue NZ$0.00. Payment Link state changes, open sessions, code commits, and internal records are not settled revenue or delivered work.
