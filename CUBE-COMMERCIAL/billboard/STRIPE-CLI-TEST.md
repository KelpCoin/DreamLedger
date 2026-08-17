# Billboard Stripe webhook testing

Two layers. Offline is required. Stripe CLI is optional and local.

## 1. Offline signed-payload tests (CI + local)

No network. No real secret. No payment claim.

```bash
node scripts/test-billboard-stripe-webhook.js
```

Covers:

- valid signature accepts
- tampered body rejects
- wrong secret rejects
- stale timestamp rejects
- paid session -> PAID_PENDING_FULFILMENT
- unpaid session rejected
- invalid signature -> 400
- non-POST -> 405

## 2. Local Stripe CLI (optional)

Requires Stripe CLI installed and logged in.

```bash
# Terminal A — forward webhooks to a local server that mounts the handler
stripe listen --forward-to localhost:3000/api/billboard-stripe-webhook

# Copy the printed webhook signing secret (whsec_...)
export STRIPE_WEBHOOK_SECRET=whsec_...

# Terminal B — trigger a test event
stripe trigger checkout.session.completed
```

Notes:

- `stripe trigger` generates a **test-mode** event. It is not a NZ$29 Billboard sale.
- Fulfilment and fossils still require human approval per fossil-schema.
- Never treat CLI trigger output as VERIFIED ECONOMIC OUTPUT.

## 3. GitHub Actions

Workflow: `.github/workflows/billboard-stripe-webhook-test.yml`

- Always runs offline tests on the cash-lane paths.
- Does not call live Stripe unless you later add optional secrets and a guarded job.

## Scoreboard rule

```
TEST PASS != PAYMENT
CLI TRIGGER != NZ$29 REVENUE
ONLY Stripe-reported paid external_event_id may move commercial state.
```
