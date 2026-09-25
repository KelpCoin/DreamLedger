# Commercial cell state machine (MVP)

```
DRAFT → PROPOSED → AUTHORIZED → PUBLISHED → CHECKOUT_ACTIVE
  → PAYMENT_PENDING → PAYMENT_SUCCEEDED → FULFILLING → FULFILLED
  → ECONOMIC_EVENT_RECORDED
```

Terminal: `BLOCKED` | `FAILED` | `REFUNDED` | `DISPUTED` | `CANCELLED`

## Authority

| Step | Actor |
|------|--------|
| Propose offer/copy | LLM or human |
| Authorize publish / spend | Human or ActionPass-lite policy |
| Create checkout | Actuator with Stripe key (not LLM) |
| Payment truth | Stripe webhook + signature |
| Fulfil | Actuator / human for tile review |
| Economic event | Deterministic writer only |

## Stripe event nuance

- `checkout.session.completed` / `payment_intent.succeeded` → payment succeeded  
- `balance.available` → funds available (separate evidence; not required for digital fulfil)  
