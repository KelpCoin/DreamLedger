# Stripe PaymentIntent settlement repair

This document records the approved repair boundary for the live revenue webhook.

## Required behavior

- Accept `checkout.session.completed`.
- Accept `payment_intent.succeeded`.
- For PaymentIntent events, resolve the Checkout Session with Stripe's `payment_intent` filter.
- Require live mode before revenue persistence.
- Persist the Stripe event before downstream writes.
- Fail with HTTP 500 on persistence failures so Stripe can retry.
- Do not create revenue orders when no Checkout Session or SKU attribution exists.
- Preserve the existing event-id idempotency constraint.
- Do not promote unmatched historical payments to RA_000001.

## Verification sequence

1. Confirm the live endpoint listens for both event types.
2. Replay one historical PaymentIntent event.
3. Confirm `stripe_webhook_events` records it.
4. Confirm a matched session produces the canonical settlement chain.
5. Confirm an unmatched PaymentIntent remains classified as unmatched and does not create `revenue_orders`.
6. Run one NZ$1 live rail test, classified as TEST/verification and excluded from RA_000001.
7. Only after the rail passes, run the first genuine external NZ$49 offer purchase.
