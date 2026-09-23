# Sentinels (Demand + Intent-to-Pay)

Two cooperating observers. **Neither is a payment system.**

| Sentinel | Role |
|----------|------|
| Demand | Interest, attention, discovery proxies |
| Intent-to-Pay | Checkout proximity / path open / abandon proxies |
| Corroboration | Joint band: IDLE / WARM / DEMAND_HEAVY / INTENT_HEAVY / HOT |

## Cloud (PC-independent)

See **`CLOUD-SENTINELS.md`**.

```bash
node BEC-PRIME/sentinels/cloud_sentinel_run.mjs
```

Workflow: `.github/workflows/cloud-demand-intent-sentinels.yml`  
Writes: `AGENT_BUS/sentinel-reports/` + `ops/demand/latest-cloud.json`

## Offline unit test

```bash
node BEC-PRIME/sentinels/corroboration.js
```

## Operator wiring (when connected)

1. Analytics / Oracle → DemandNotes  
2. Stripe open/abandon (not paid) → IntentNotes  
3. Paid sessions → Settlement Sync only  

## Data

`BEC-PRIME/sentinels/data/` — local; cloud reports live under AGENT_BUS.
