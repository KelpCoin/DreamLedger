# Autonomous revenue engine — spine

**Honest status:** pieces exist across the repo; autonomy is **not** achieved while external demand and proven webhook→fulfil E2E remain open.

**Meter:** `verified_external_revenue_nzd = 0` until live external settle + fulfil + fossil.

**Human builder forbidden (2026-10-20).** Agents execute jobs in `REVENUE-ENGINE-JOBS.json`.

---

## Figure-eight stages → repo modules

| Stage | Module | Status |
|-------|--------|--------|
| 1 Demand signals | Cloud sentinels + Oracle | Partial — probes rails, not strangers |
| 2 Opportunity | `ECONOMIC-LOOPS/registry.json` | Live offers registered |
| 3 Offer | approved catalog + `/api/offers` | Live |
| 4 Distribution | `FIRST-SALE-EXECUTION-PACK.md` | **Human or approved pulse only** |
| 5 External buyer | World | **Missing** |
| 6 Payment | Stripe Payment Links | Live |
| 7 Settlement | Commerce Settlement Sync | Needs secrets + plink align |
| 8 Fulfilment | fulfilment registry + wall | Partial |
| 9 Proof / fossil | fossil path under `proof/autonomy/` | Checklist |
| 10 Learn | Bridge handoffs + balls | Manual |
| 11 Repeat | REV-012 after first fossil | Blocked until L3 |

---

## Autonomy levels (do not skip)

| Level | Meaning | Gate |
|-------|---------|------|
| L0 | Docs only | — |
| L1 | Settlement Sync runs; meter honest at 0 | Secrets + REV-001..003 |
| L2 | Webhook → fulfil path proven on one test product | REV-004..005 |
| L3 | First **external** pay + fossil | REV-010 |
| L4 | Second pay without new architecture | REV-012 |
| L5 | Multi-offer settlement + wall digital auto | Config |
| L6 | Demand automation assists (never fabricates buyers) | Policy |

**Current target:** L1–L3. Claiming L6 without L3 is a lie.

---

## Status runner

```bash
node ops/autonomy/run-revenue-spine-status.mjs
```

Writes `proof/autonomy/latest-spine-status.json`. Does not claim revenue.

---

## What still cannot be automated away

- Stranger intent to pay  
- Legal/tax identity of the merchant  
- Owned-channel posting rights (unless separately approved automation)  
- Stripe dashboard ownership  
