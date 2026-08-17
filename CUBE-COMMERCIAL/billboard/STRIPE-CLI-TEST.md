# Billboard Stripe webhook testing

## Acceptance before merge (idempotency)

Trigger the same `checkout.session.completed` event twice (Stripe CLI or Dashboard test mode).

Expected:

```text
first event  = 200, duplicate: false
second event = 200, duplicate: true
payment records = 1
```

If duplicate count is not enforced, PR fails merge readiness.

## Env (production / Vercel)

```text
STRIPE_WEBHOOK_SECRET=whsec_...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Do not use the filesystem for idempotency on Vercel serverless.

## Offline tests (required)

```bash
node scripts/test-billboard-stripe-webhook.js
# or
npm run test:billboard-webhook
```

Uses in-memory store (`BILLBOARD_IDEMPOTENCY_BACKEND=memory`). No KV required for CI.

## Local Stripe CLI (optional)

```bash
stripe listen --forward-to localhost:3000/api/billboard-stripe-webhook
export STRIPE_WEBHOOK_SECRET=whsec_...   # from listen
stripe trigger checkout.session.completed
# trigger again with same event id path to observe duplicate: true after first durable write
```

CLI triggers are test-mode. They are not NZ$29 Billboard revenue.

## Scoreboard rule

```text
TEST PASS != PAYMENT
CLI TRIGGER != NZ$29 REVENUE
ONLY Stripe-reported paid external_event_id may move commercial state.
```
