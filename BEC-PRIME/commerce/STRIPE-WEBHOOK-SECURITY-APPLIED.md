# Stripe webhook security — applied contract

Complements `STRIPE-WEBHOOK-PERFORMANCE.md` and `verify-stripe-webhook-contract.js`.

## Applied requirements (production)

1. **Raw body** signature verify via official Stripe SDK + `STRIPE_WEBHOOK_SECRET` (env only).  
2. **Reject** missing/invalid signature with **400** before business logic.  
3. **Idempotency** on `event.id` (unique store) before side effects; also domain key on `checkout_session_id` for fulfil.  
4. **Allowlist events:** prefer `checkout.session.completed` / `payment_intent.succeeded`; ignore noise.  
5. **Validate** amount, currency, livemode, approved offer / published product (existing contract checks).  
6. **Return 2xx fast** after durable record + enqueue; heavy report/LLM async.  
7. **Performance Wall mint** or billboard path only after verify + idempotent insert.  
8. **No secrets in git.** Rotate webhook secret with overlap window documented below.  
9. **HTTPS only** endpoint.  
10. **Timestamp tolerance** default SDK (~5 min).  

## Existing repo enforcement

`BEC-PRIME/scripts/verify-stripe-webhook-contract.js` already asserts:

- dedupe by `event.id`  
- guest-nullable account_id  
- published product  
- currency/amount match  
- ledger event id from Stripe  
- product metadata on PaymentIntent  

**Operator:** run `node BEC-PRIME/scripts/verify-stripe-webhook-contract.js` in CI or pre-deploy.

## Rotation runbook (applied)

1. Create new endpoint secret in Stripe.  
2. Deploy env with new secret (or dual-verify briefly if supported).  
3. Disable old secret.  
4. Confirm test event + live ping.  

## Failure policy

| Case | Response |
|------|----------|
| Bad signature | 400 |
| Duplicate event.id | 200 skip |
| Unknown offer | 200 + quarantine log (avoid retry storm) or 400 per strict policy |
| Transient DB | 500 so Stripe retries |

## Money truth

Webhook security ≠ revenue. Settlement Sync + fossil still required for verified NZD.
