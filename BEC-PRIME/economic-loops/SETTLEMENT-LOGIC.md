# Loop settlement logic

## Authority chain

```
Approved offer (catalog)
  → configured Payment Link / price / currency
  → Stripe live Checkout Session (paid, livemode)
  → Commerce Settlement Sync (idempotent event id)
  → Fulfilment path (per loop)
  → Fossil / proof package
  → ONLY THEN: verified_external_revenue_nzd += amount
```

## Stages inside a loop instance

| Stage | Owner | Fail closed if |
|-------|--------|----------------|
| DISCOVER | Face / agent / Oracle | — |
| OFFER | Approved catalog | offer not approved |
| AUTHORIZE | Human (or AP2-like later) | no buyer authorization |
| PAY | Stripe | test mode, unpaid, wrong amount/currency |
| SETTLE | Settlement Sync | link not in approved+configured set |
| FULFIL | Loop-specific | cannot deliver |
| PROOF | Fossil writer | missing hash / refs |
| LEARN | Demand + Intent Sentinels | — |
| RECOMPILE | BEC compiler | — |

## Idempotency

Event key: `STRIPE-CHECKOUT-{checkout_session_id}`  
Re-running sync must not double-count.

## Sentinels vs settlement

| System | Can move revenue meter? |
|--------|-------------------------|
| Demand Sentinel | **No** |
| Intent-to-Pay Sentinel | **No** |
| Settlement Sync + fossil | **Yes** |

## Multi-loop

Each loop instance is independent.  
Cross-silo settlement sharing is forbidden.  
Integrated edges may *suggest* upsells; they do not merge proof records.

## Air-gap

Settlement recognition requires connectivity to Stripe **or** an imported signed export.  
Offline, the system may queue IntentNotes and DemandNotes only.
