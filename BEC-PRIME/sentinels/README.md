# Sentinels (Demand + Intent-to-Pay)

Two cooperating observers. **Neither is a payment system.**

| Sentinel | Role |
|----------|------|
| Demand | Interest, attention, discovery |
| Intent-to-Pay | Checkout proximity, handoffs, abandon |
| Corroboration | Joint band: IDLE / WARM / DEMAND_HEAVY / INTENT_HEAVY / HOT |

## Quick offline test

```bash
node BEC-PRIME/sentinels/corroboration.js
```

## Operator wiring (when connected)

1. Pipe analytics / Oracle / agent logs → DemandNotes  
2. Pipe Stripe Checkout events (open/abandon only) → IntentNotes  
3. Paid sessions stay on Settlement Sync path only  

## Data dir

`BEC-PRIME/sentinels/data/` — local or synced; safe empty in air-gap.
