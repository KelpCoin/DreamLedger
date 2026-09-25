# Commercial execution layer (minimum)

**Not a Polsia clone.** See **`POLSIA-DREAMLEDGER-GAP-MATRIX.md`** for full component desk.

```
LLM proposes → policy / ActionPass-lite → actuator → Stripe
                                                      ↓
                              verified webhook → payment → fulfil → economic_event
```

LLM **never** holds unrestricted Stripe keys and **never** declares revenue.

## Phases

| Phase | Goal | Done when |
|-------|------|-----------|
| **0** | Instrumentation | Stripe event → order/payment/evidence/economic_event |
| **1** | Human-guided cell | External buyer → fulfil → economic_event |
| **2** | Bounded autonomy | Pre-authorized actions + spend caps |
| **3+** | Multi-cell / factory | After replication evidence |

## Key files

| File | Role |
|------|------|
| `POLSIA-DREAMLEDGER-GAP-MATRIX.md` | Full Polsia→DL gap desk |
| `SCHEMA.md` / `schema.sql` | Minimum tables |
| `money_pipeline.py` | Local verified ingest |
| `STATE_MACHINE.md` | MVP states |
| `POLSIA-LESSONS.md` | Short lessons |
| `DO-NOT-BUILD-YET.md` | Explicit backlog freeze |

## Existing rails

Payment Links, `/buy/...`, Settlement Sync, approved catalog, public shop, Agent Bridge.
