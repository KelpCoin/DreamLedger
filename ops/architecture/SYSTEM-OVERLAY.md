# System overlay — existing DreamLedger + care + money

**Updated:** 2026-09-26  
**For:** Operator (husband) + partner (wife) + every LLM on the bus  
**Rule:** The system looks after the family by **closing economic loops**, not by claiming work that didn’t ship or revenue that didn’t settle.

```
VERIFIED DEMAND → OFFER → BUYER → PAY → SETTLE → FULFIL → PROOF → LEARN → REPEAT
         ↑__________________________________________________________________|
                              Agent Bridge pinball
```

Verified external revenue remains **NZ$0** until livemode external Stripe evidence.

---

## 1. What already exists (do not rebuild)

| Subsystem | Where | Overlay role |
|-----------|-------|----------------|
| Agent Bridge | `AGENT_BUS/BRIDGE/`, protocol docs | Hand-off between LLMs / devices |
| Pinball / balls | `AGENT_BUS/PING_PONG_BALLS.json` | Current priorities + truth |
| Economic loops | `AGENT_BUS/ECONOMIC-LOOPS/` | Loop registry + advance scripts |
| Commercial Phase 0–1 | `ops/commercial/` | Money pipe + cells + ActionPass |
| Settlement Sync | GitHub Actions commerce workflow | Meter when `cs_` appears |
| Catalog / plinks | `BEC-PRIME/catalog/offers/approved.json` | Executable offers |
| Public store | `public/index.html` (`store-v2` on main) | Face for strangers |
| Cube / compiler / sandbox | `BEC-PRIME/` | Compile silos → surfaces |
| Supabase | project tables / migrations | Persistent silo + account state |
| Word banks / workers | `ops/memory/`, `ops/workers/` | Multi-LM jobs + phrase memory |
| Winning patterns desk | `ops/architecture/WINNING-PATTERNS-STACK.md` | Borrowed machinery |

**Overlay principle:** New work **plugs into** these paths. No parallel shadow system.

---

## 2. Cells vs silos (Supabase / product truth)

You may have generated on the order of **~1M experimental cell records** as proof-of-concept. Only a fraction become **true silos**.

| Term | Meaning | Count intent |
|------|---------|--------------|
| **Cell** | Thin experiment / draft / auto-spawn | Many (POC scale) |
| **True silo** | Durable product line: CTA, offer or free path, fulfilment or clear free value, not leaked ops junk | Target **~500** quality |
| **Money silo** | True silo with live Stripe path + evidence chain | Few first (tile, diagnostic, kit) |
| **Care silo** | Supports household (course, identity, play) without fake revenue | Explicit; separate from money claims |

### Promotion rule (cell → true silo)

A cell becomes a **true silo** only if:

1. Public-safe name + one CTA  
2. Fulfilment path defined (or free, clearly free)  
3. No internal/ops language on public surface  
4. Stored with stable `silo_id` on Supabase (or catalog)  
5. Optional: `is_true_silo = true` flag  

Everything else stays **cell** (sandbox, research, compiler fodder).

### Supabase overlay fields (logical)

```
silos / cells table (logical — align to actual table names in project):
  id
  kind: cell | true_silo | money_silo | care_silo
  title
  cta_url
  price_cents nullable
  status: draft | live | archived
  is_true_silo boolean
  public_safe boolean
  evidence_notes
  updated_at
```

Migration note for humans: apply when ready; do not invent live schema drift. See `ops/architecture/SILO-TAXONOMY.md`.

---

## 3. Agent Bridge + pinball LLM time

**Pinball** = durable state in `PING_PONG_BALLS.json` + handoffs so the next model continues without the chat.

```
LLM A  →  writes ball / handoff / inbox  →  LLM B
              (GitHub is the bumper)
```

| Ball | Meaning |
|------|--------|
| **C** | Commerce / cash path — post links, settle, fulfil |
| **W** | Website / public surface |
| **A** | Architecture / overlay |
| **B** | Bridge health |

**LLM time rules:**

1. Read balls + latest `AGENT_BUS/HANDOFF-*` before expanding scope  
2. Prefer smallest change that moves **C** or verifies pay  
3. Write handoff when done — never leave truth only in chat  
4. Multi-LM: any model may propose; **none** may mint revenue  
5. LM Studio / GPU workers = draft jobs only (`ops/workers/`)  

Bridge protocol remains fail-closed on money.

---

## 4. How the system “looks after” you and your wife

Not sentiment — **mechanics**:

| Need | System behaviour |
|------|------------------|
| See progress | Balls + handoffs on GitHub (husband can open paths) |
| Don’t lie about money | `verified_external_revenue_nzd` only from evidence |
| Reduce cognitive load | Phase-1 cells already **authorized** — next is distribute |
| Care offerings | Care silos (e.g. home beautician course path) stay **labeled care**, not fake ARR |
| Continuity when tired | Pinball + bridge so another LLM picks up |
| Safety | ActionPass-lite; no LLM Stripe keys |

**Household loop (care + money):**

```
Money silos (tile / diag / kit)
  → external pay → fulfil → proof
Care silos (course, play, identity)
  → retention / goodwill → optional later conversion
Bridge
  → keeps both classes moving without mixing claims
```

---

## 5. Life in the system (activation checklist)

### Daily pinball (operator or agent)

1. `cat AGENT_BUS/PING_PONG_BALLS.json`  
2. `python3 ops/commercial/cell_status.py`  
3. If cells authorized → **post buy URL** (Ball C)  
4. Settlement Sync ready  
5. On pay → fulfil → economic_event → bump ball truth  

### Weekly

1. Promote ≤ N cells → true silos (quality bar)  
2. Archive junk cells  
3. Refresh word banks only from what converted  

### Do not

- Celebrate 1M cells as 1M businesses  
- Mix care content into verified revenue  
- Build 500 money silos before one external economic_event  

---

## 6. First money silos (already live)

| Silo | Price | Buy |
|------|-------|-----|
| Billboard tile | NZ$50 | `/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001` |
| Commander diagnostic | NZ$29 | `/buy/COMMANDER-DECK-DIAGNOSTIC-001` |
| Discord webhook kit | NZ$79 | `/buy/DISCORD-WEBHOOK-STARTER-KIT-001` |

These are the **proof of life** for money. 500 true silos come **after** the pipe proves once.

---

## 7. Overlay diagram

```
                    ┌─ public store-v2 ─┐
                    │  (face)            │
                    └────────┬───────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     │                       │                       │
 money silos            care silos              cell lake
 (Stripe)               (retain)              (POC / sandbox)
     │                       │                       │
     └───────────┬───────────┴───────────┬───────────┘
                 │                       │
          commercial state          compiler / cube
          ActionPass                word banks
                 │                       │
                 └───────────┬───────────┘
                             │
                    AGENT BRIDGE + BALLS
                    (pinball LLM time)
                             │
                    Supabase persistence
```

---

## 8. File index (this overlay)

| Path | Purpose |
|------|--------|
| `ops/architecture/SYSTEM-OVERLAY.md` | This document |
| `ops/architecture/SILO-TAXONOMY.md` | Cell vs true silo rules |
| `ops/architecture/PINBALL-LLM-TIME.md` | Bridge + balls operating rhythm |
| `ops/architecture/CARE-AND-MONEY.md` | Household care vs revenue honesty |
| `AGENT_BUS/PING_PONG_BALLS.json` | Live pinball state |
