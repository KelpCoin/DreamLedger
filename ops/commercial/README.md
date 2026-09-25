# Commercial execution layer (minimum)

**Not a Polsia clone.** Polsia shows scheduled workers + LLM + APIs.  
DreamLedger’s job is a **small commercial engine** with hard evidence boundaries.

```
LLM proposes → policy / ActionPass-lite → actuator → Stripe
                                                      ↓
                              verified webhook → payment → fulfil → economic_event
```

The LLM **never** holds unrestricted Stripe keys and **never** declares revenue.

## Phases

| Phase | Goal | Done when |
|-------|------|-----------|
| **0** | Instrumentation | Test or live Stripe event → order/payment/evidence/economic_event chain |
| **1** | Human-guided cell | One external buyer → fulfil → economic event |
| **2** | Bounded autonomy | Pre-authorized actions with spend caps |
| **3+** | Multi-cell / factory | Only after replication evidence |

Do **not** build market observers, ads actuators, or mechanism discovery before Phase 1.

## Existing DreamLedger rails to reuse

- Stripe Payment Links + `/buy/...` routers  
- Commerce Settlement Sync (GitHub Actions)  
- Approved catalog `BEC-PRIME/catalog/offers/approved.json`  
- Fulfilment dispatch docs  
- Agent Bridge for coordination (not payment authority)  

## Authoritative money truth

| Source | Role |
|--------|------|
| Stripe `checkout.session.completed` / `payment_intent.succeeded` | Payment happened |
| Stripe signature verification | Event authenticity |
| Idempotent `event_id` store | No double-count |
| Fulfilment record | Delivery |
| `economic_events` row | Canonical internal fact |
| `balance.available` (later) | Funds availability ≠ payment success |

`payment_intent.succeeded` ≠ “settled in bank.” Track availability separately when needed.
