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
