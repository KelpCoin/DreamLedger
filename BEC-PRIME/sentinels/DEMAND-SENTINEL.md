# Demand Sentinel

## Purpose

Observe and record **signals that people want something** — before money moves.  
Does **not** create revenue. Feeds Intent-to-Pay Sentinel and LEARN stage of economic loops.

## Air-gap mode

Runs fully offline on local event logs. Operator connects feeds later (web analytics, search, social, Truth Oracle queries, agent traffic).

## Signal classes (v1)

| Code | Meaning | Example |
|------|---------|---------|
| `D-VIEW` | Face or offer viewed | market page, silo CTA |
| `D-SEARCH` | Search / Truth Oracle query | “cheaper power NZ” |
| `D-CLICK` | CTA click (not pay) | Buy tile button |
| `D-SHARE` | Share / outbound post engagement | share-pack link |
| `D-AGENT` | Agent discovered offer via API | `/api/offers` |
| `D-RETURN` | Returning visitor to same silo | repeat garden or market |

## Output contract

Each observation is a **DemandNote** (see `schema/demand-note.json`).  
Stored under `BEC-PRIME/sentinels/data/demand/` when online; local path configurable when air-gapped.

## Rules

1. Aggregate is allowed; inventing volume is not  
2. Game activity may be demand for *play*, never for *business revenue*  
3. Demand without intent-to-pay is weak signal only  
4. Silo tag required on every note  

## Corroboration

Demand Sentinel emits notes. Intent-to-Pay Sentinel may **confirm** or **discount** them.  
Joint score = `corroboration.js` protocol — never a payment event.
