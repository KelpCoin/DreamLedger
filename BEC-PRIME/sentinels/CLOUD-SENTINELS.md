# Cloud Demand + Intent-to-Pay sentinels

## Purpose

Run **without the PC on**: GitHub Actions probes live DreamLedger surfaces, scores **proxies** of demand and checkout reachability, corroborates, and **writes JSON + handoff to the repo**.

| Sentinel | Cloud probe |
|----------|-------------|
| **Demand** | Homepage, billboard, MTG, `/api/offers` — price visible, buy affordances |
| **Intent-to-Pay** | `/buy/...` reaches Stripe Checkout (path open ≠ paid) |
| **Corroboration** | Existing `corroboration.js` bands |

## What this is not

- Not verified revenue  
- Not permission to spam the internet  
- Not a replacement for `ops/money/DEMAND-KIT.md` human posts  
- Not Stripe webhook fulfilment  

## How to run

**Cloud (preferred):** Actions → **Cloud Demand + Intent Sentinels** → Run workflow  
Schedule: every 6 hours on `main`.

**Local:**

```bash
node BEC-PRIME/sentinels/cloud_sentinel_run.mjs
```

## Outputs (GitHub)

| Path | Content |
|------|---------|
| `AGENT_BUS/sentinel-reports/latest.json` | Full report |
| `AGENT_BUS/sentinel-reports/LATEST-HANDOFF.md` | Human/LLM summary |
| `ops/demand/latest-cloud.json` | Same report for demand ops |
| Actions artifact | `cloud-sentinel-{run_id}` |

## Ambition widen (next layers)

1. **Optional** Reddit/HN keyword harvest → demand notes with `source: public_web` (rate-limited, read-only)  
2. Stripe **Checkout Session completed=false** abandon feeds → intent notes (needs secret, careful privacy)  
3. Corroboration HOT → open GitHub Issue assigned to operator with DEMAND-KIT link only  

Layer 1–2 require explicit operator enable flags so the bus does not scrape aggressively by default.

## Relation to money pack

Sentinel says **rails work / surfaces expose offers**.  
Money pack says **go post**.  
Settlement Sync says **someone paid**.
