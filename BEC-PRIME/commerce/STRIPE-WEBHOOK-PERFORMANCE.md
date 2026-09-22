# Stripe webhook performance (BEC)

## Role in the figure-eight

Webhook = **penstock** into the settle lobe. It must be fast, fail-closed, and **idempotent**. It is not the place for heavy rendering or marketing logic.

```text
Stripe event → verify signature → classify → mint Performance Wall cubby
             (or specialized fulfil) → 200 quickly → fossil async if needed
```

---

## Performance rules

| Rule | Why |
|------|-----|
| Verify signature first | Reject garbage before work |
| Idempotent on `event.id` / `checkout_session_id` | Stripe retries |
| Return **2xx fast** | Avoid retry storms |
| Heavy work async | Report generation, image fetch — queue if > few hundred ms |
| Wall mint is O(1) DB write | Default path stays cheap |
| Never block on Settlement Sync | Sync is separate GitHub Actions meter |

---

## Recommended handler budget

1. Parse + signature verify  
2. Ignore non-live / non-paid if policy says so  
3. Match approved offer (amount, currency, link id)  
4. **Performance Wall `mint`** (or specialized fulfil stub)  
5. Persist proof row  
6. Respond `200`  

Email / LLM / ComfyUI **after** 200.

---

## Events to care about

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Primary mint trigger when `payment_status=paid` |
| `payment_intent.succeeded` | Backup / correlation |
| Others | Log; do not mint twice |

---

## Failure modes

| Failure | Response |
|---------|----------|
| Bad signature | 400; no mint |
| Unknown offer | 200 + quarantine log (avoid infinite retry) or 400 per policy |
| Duplicate session | Return existing cubby; 200 |
| Downstream timeout | 500 only if mint not durable; prefer durable mint then 200 |

---

## Existing repo anchors

- `BEC-PRIME/lib/stripeWebhookProof.js`  
- `BEC-PRIME/lib/billboardAutoFulfillment.js`  
- `BEC-PRIME/routes/marketplaceWebhook.js`  
- `BEC-PRIME/scripts/verify-stripe-webhook-contract.js`  

Default **new** digital SKUs should call **Performance Wall** from the webhook path rather than new bespoke arms.

---

## Relation to revenue meter

Webhook fulfilment ≠ verified revenue.  
Meter remains **Commerce Settlement Sync** + fossil. Webhook opens the cubby; the dam still requires the full evidence chain.
