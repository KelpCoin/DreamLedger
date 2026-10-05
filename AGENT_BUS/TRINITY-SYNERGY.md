# Trinity synergy — Elohim × Gauntlet × Agent Bridge

**Money path (live now):**  
https://dreamledger.org/toll-road · NZ$9 Evidence · NZ$19 Decision

**Synergy product (this branch):** `trinity` scope · NZ$49 · 25 runs · `/api/toll/v1/trinity`

## Roles

| Name | Role | Endpoint |
|------|------|----------|
| **Elohim** | Truth / evidence boundary — classifies only, never invents economic facts | `/api/toll/v1/truth` (also step 1 of Trinity) |
| **Gauntlet** | Decision gate — structured PASS/FAIL on candidates | `/api/toll/v1/gauntlet` (also step 2 of Trinity) |
| **Agent Bridge** | Coordination — passport, rooms, notes, events | `/api/toll/v1/agent-passport`, rooms, bridge-events (also step 3 of Trinity) |

## Composition
```
identity (optional passport)
  → Elohim truth boundary
  → Gauntlet decision
  → Bridge coordination
```

Synergy result:
- `ALIGNED` — evidence not contradicted + Gauntlet PASS → coordination issued
- `BLOCKED_BY_TRUTH` — Elohim contradicted
- `BLOCKED_BY_GAUNTLET` — decision FAIL

## Why this is cutting-edge
Agents and humans get **one paid run** that binds truth, decision, and coordination without inventing revenue. Other systems can verify passports; Elohim refuses to polish reality for money; Gauntlet stays a hard gate.

## Revenue
NZ$0 until independent external Stripe settlement. Checkout:  
`/api/toll/v1/checkout/trinity` (after this branch deploys)  
Until then: live NZ$9 / NZ$19 on production.
