# Marketplace production-readiness gate

This gate supplements static UI checks. It is not a production certification.

## A2A checkout handoff

- Configure `M2M_QUOTE_SIGNING_SECRET` as a high-entropy secret in the deployed Render service. Do not commit it or expose it to browser code.
- Without that secret, quote and authorization endpoints must return HTTP 503 and must not create checkout sessions.
- Quotes are HMAC-signed over product ID, current price, currency, and issue time. Authorization rejects altered, mismatched, or expired quotes (15-minute maximum).
- The browser must display the quoted price, require an explicit confirmation, validate the server authorization response, and only then call the existing `/api/checkout/create` route.
- The checkout route must re-read the current product record and validate publication, silo, approval gate, and inventory. The browser never supplies the amount.
- A checkout session is not a payment. A payment is not verified revenue until the signed webhook, durable order, entitlement, fulfillment, delivery evidence, and independent settlement proof agree.

## Release blockers while Supabase SQL is unavailable

- Do not claim B2B RFQs, offers, orders, or entitlements are durable if their only persistence is local JSON files.
- Do not merge or promote the marketplace transaction path until the canonical Supabase data plane is reachable and existing tables/RLS policies have been inspected.
- Before production promotion, prove webhook concurrency/idempotency, inventory reservation, refund/dispute state transitions, seller payout gating, RLS isolation, authorization scope, and fulfillment retries with automated tests.
- Keep the supplier quote-comparison worksheet free. Do not re-advertise the retired NZ$49 offer.
- Keep x402 mainnet settlement disabled until the payee, asset allowlist, spend limits, replay controls, and settlement verification are independently tested.

## Current status

Code and static contract checks can be reviewed in the PR. This document does not assert that secrets are configured, Supabase is healthy, Stripe events have been processed, or a live marketplace transaction has succeeded.
