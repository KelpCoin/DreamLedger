# Ecosystem done-states (canonical)

**Rule:** The ecosystem is not “finished” by more design docs. It is finished when each gate below is **VERIFIED** with evidence. Anything not listed is out of scope until these pass.

Verified revenue remains **NZ$0** until a real external settlement + fulfilment proof exists.

---

## Gate map

```text
CORTEX (factory)
  G1  Builder v1 merged (#306)
  G2  Autonomous job #304 → rename PR → human merge
  G3  Blocked job → repair → proof without human file edits

PHINHAVEN (game)
  G4  Live RPC defs captured (move, harvest, deposit, spawn)
  G5  One coordinate plane (spawn ↔ nodes ↔ deposit)
  G6  PLAYER_READY: spawn→move→harvest→return→deposit proven on live
  G7  User-facing name PhinHaven; kelplantis_* preserved

MONEY
  G8  One canonical checkout identity per SKU (no link drift)
  G9  Webhook → idempotent payment row → auto digital fulfil → proof
  G10 First external settled payment (RA_000001)
  G11 Repeatable path to NZ$100 / NZ$1000 (same offers, not new architecture)

OWNER
  G12 Exceptional gates only: merge, outreach, spend, destructive prod
```

---

## Current state (2026-09-15)

| Gate | Status |
|------|--------|
| G1 Builder v1 | **OPEN** — draft PR #306 |
| G2 Rename by machine | **BLOCKED** on G1 merge |
| G3 Self-repair factory | **NOT PROVEN** |
| G4 RPC dumps | **MISSING** (needs live Supabase) |
| G5 Coordinate plane | **BLOCKED** on G4 |
| G6 PLAYER_READY | **NOT PROVEN** |
| G7 PhinHaven brand | Issue #304 corrected; rename not executed |
| G8 Checkout identity | Partial; drift risk noted |
| G9 Auto fulfil | Rails claimed live; treat as verify-per-SKU |
| G10 First payment | **NZ$0** |
| G11 Scale | N/A until G10 |
| G12 Owner mode | **ACTIVE** by policy |

Open PRs must not all merge at once. Order: **#306 → machine #304 → game G4–G6 → money G10.**

---

## What “finish the ecosystem” means in practice

1. **Human:** Merge #306 if review passes (arms CORTEX Builder).  
2. **Machine:** Claim #304, open rename PR, human merges rename.  
3. **Human/DB:** Dump `kelplantis_move_player` + harvest + deposit + spawn; fix one plane; prove gold loop.  
4. **Human:** One outbound link → first Stripe settlement → fulfil → proof.  
5. **Stop building new subsystems** until G6 and G10 are true.

---

## Explicit non-goals until G6 + G10

- Floor 2 / MMO marketing  
- New offer invention as a substitute for distribution  
- Autonomous public outreach without standing policy  
- Treating simulated `banked_gold` as revenue  
- Merging every open draft PR without ordering

---

## Owner residual authority

Approve/merge PRs · outreach · spend · irreversible production · anything that would falsify economic truth.

Everything else trends toward CORTEX jobs with evidence.
