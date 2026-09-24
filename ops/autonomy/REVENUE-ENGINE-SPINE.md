# Autonomous revenue engine — spine

**Honest status:** pieces exist across the repo; autonomy is **not** achieved while external demand and proven webhook→fulfil E2E remain open. This spine **wires** what is missing as an executable map.

**Meter:** `verified_external_revenue_nzd = 0` until live external settle + fulfil + fossil.

---

## Figure-eight stages → repo modules

| Stage | Module | Status |
|-------|--------|--------|
| 1 Demand signals | Cloud sentinels + Oracle | Partial — probes rails, not strangers |
| 2 Opportunity | `ECONOMIC-LOOPS/registry.json` | Live offers registered |
| 3 Offer | `approved.json` + `/api/offers` | Live |
| 4 Distribution | `ops/money/DEMAND-KIT.md` | **Human gate** |
| 5 External buyer | World | **Missing** |
| 6 Payment | Stripe Payment Links | Live |
| 7 Settlement | Commerce Settlement Sync | Needs secrets + plink align |
| 8 Fulfilment | `fulfillment/DISPATCH.md` + wall | Partial |
| 9 Proof / fossil | `scripts/fossil_checklist.py` | Checklist |
| 10 Learn | Bridge handoffs + balls | Manual |
| 11 Repeat | Cadence in THIS-WEEK pack | Human |

Parallel agent lobe: **Agent Bridge** (`AGENT_BUS/BRIDGE/`).

---

## Autonomy levels (do not skip)

| Level | Meaning | Gate |
|-------|---------|------|
| L0 | Docs only | — |
| L1 | Settlement Sync runs; meter honest at 0 | Secrets |
| L2 | Webhook → fulfil path proven on one test product (not counted as revenue if self-test) | Operator |
| L3 | First **external** pay + fossil | Demand |
| L4 | Second pay without new architecture | Cadence |
| L5 | Multi-offer settlement + wall digital auto | Config |
| L6 | Demand automation assists (never fabricates buyers) | Policy |

**Current target:** L1–L3 via this-week pack. Claiming L6 without L3 is a lie.

---

## Missing glue this commit addresses

1. Bridge **inbox processor** (`scripts/bridge_process_inbox.py`)  
2. **Loop runner** air-gap status (`scripts/loop_status.py`)  
3. **Fulfilment dispatch registry** use path  
4. **Fossil checklist** CLI  
5. Bridge protocol **v1.1** (router rules)  
6. Engine **self-check** workflow inputs doc  

---

## What still cannot be automated away

- Stranger intent to pay  
- Legal/tax identity of the merchant  
- Owned-channel posting rights  
- Stripe dashboard ownership  
