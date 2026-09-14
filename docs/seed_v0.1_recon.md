# Seed v0.1 Recon — economic-game-mvp branch

**Date:** 2026-09-15  
**Branch tip inspected:** `549cf86a8043214ff9082cfb4e338f7928871c4d`  
**Scope:** Read-only inventory. No production-code changes.  
**Doctrine applied:** The repository’s existing engine (where present) is authoritative. Prompts describe intended contracts; they must not invent rules that contradict what is already on the branch.

---

## 1. What actually exists on the branch

### Present under `game-economy-mvp/`

| Path | Size | Role |
|------|------|------|
| `README.md` | 1.6 KB | High-level description of deterministic MVP |
| `COLLAB.md` | 1.5 KB | Dual-operator collaboration note |
| `REVENUE_PATH.md` | 2.4 KB | Near-term revenue paths (Path A/B/C) |
| `play.py` | 7.9 KB | Interactive CLI play loop |
| `game/economy/types.py` | 5.7 KB | Fixed-point types, entities, `TransactionState` enum |
| `game/economy/player_loop.py` | 11.6 KB | Hardened decision-loop surface (inspect / calculate / authorize / tick / proof) |
| `game/work_packet.py` | 3.5 KB | Work Packet schema + legal state transitions |

### Present under `docs/` (relevant)

| Path | Role |
|------|------|
| `ARCHITECTURE_DUAL_WORLD.md` | Dual-world boundary; game never pretends to be real |
| `WORK_PACKET_SCHEMA.json` | Formal schema |
| `WORK_PACKET_STATE_MACHINE.md` | Binding state machine + Elohim authority limits |

### Critically **absent** from the branch

| Expected by handover / prompts | Status on branch |
|--------------------------------|------------------|
| `game/economy/engine.py` | **MISSING** |
| `game/simulation/seeded_random.py` | **MISSING** |
| `game/proof/economic_mvp_proof.json` | **MISSING** |
| `game/tests/` (any test files) | **MISSING** |
| `run_mvp.py` | **MISSING** |

**Consequence:** `player_loop.py` and `play.py` both import `from .engine import EconomyEngine` / `from game.economy.engine import EconomyEngine`. On the current branch those imports cannot resolve. The branch is not a runnable economic engine; it is a partial surface that assumes an engine that was never committed.

Local sandbox (`/home/workdir/artifacts/dreamledger_mvp/`) does contain a working `engine.py`, `seeded_random.py`, tests, and a proof artifact. That local tree is **not** the repository source of truth until it is committed.

---

## 2. Transaction lifecycle as defined on the branch

From `game/economy/types.py` — `TransactionState` enum (authoritative for any code that uses these types):

```
DISCOVERED
AUTHORIZED
RESERVED
EXECUTED
IN_TRANSIT
DELIVERED
SOLD
SETTLED
REJECTED
CANCELLED
FAILED
EXPIRED
```

Note: There is **no** `ARRIVED` state in the types on the branch. The hardened prompt sequence that includes `ARRIVED` is an intended contract, not the current repository enum.

`player_loop.py` treats authorization as producing `AUTHORIZED`, then `execute_authorized` calls into the (missing) engine’s `execute_and_settle`, which (from local knowledge, not branch) collapses multiple steps into one call. The branch does **not** currently expose a multi-tick transit progression API that advances `IN_TRANSIT → … → SETTLED` one step per `tick()`.

**Implication for World Tick prompts:** Do not assume `RESERVED → EXECUTED → IN_TRANSIT → ARRIVED → DELIVERED → SOLD → SETTLED` is already implemented as discrete, tick-advanced phases. The recon must treat that sequence as a target contract to be reconciled against the real engine once it is present on the branch, not as an existing behaviour.

---

## 3. Player decision loop surface (what is on the branch)

`player_loop.py` defines:

- `inspect(market_id, commodity_id) → MarketView | None` — pure read, no side effects claimed.
- `calculate_opportunities(actor_id, rank_by, limit) → List[RankedOpportunity]` — three rankings: `absolute_profit`, `return_on_capital`, `profit_per_capital_tick`.
- `authorize(...) → (Transaction | None, RejectReason | None)` — enumerable rejection reasons.
- `execute_authorized(tx_id)` — rejects if status is not `AUTHORIZED` / `RESERVED`.
- `tick(npc_actions)` — increments tick, ages `price_age`, calls `engine.tick_npcs`.
- `proof(tx_id)` / `proof_canonical_json(tx_id)` — deterministic artifact shape.

These methods **depend on** `EconomyEngine` methods that do not exist on the branch:

- `engine.authorize_trade`
- `engine.execute_and_settle`
- `engine.tick_npcs`
- `engine.state` (full GameState with markets, routes, avatar, npcs, etc.)

Until `engine.py` is committed, the player loop is a non-runnable façade.

---

## 4. Market / price-update behaviour (unknown on branch)

Because `engine.py` is absent, the following cannot be verified from the repository:

- Whether player settlement already mutates market prices / liquidity / supply.
- Whether only NPC settlements affect prices.
- How (or if) `price_age` is reset on price-changing events.
- How route capacity is reserved and released.

**Doctrine reminder:** Any World Tick prompt that says “Apply market price updates from settled NPC trades only” would be **introducing a new economic rule** if the existing (local) engine already updates prices on player settlement. That must be verified against the actual engine before implementation, not assumed from a prompt.

---

## 5. Work Packet layer (present and coherent)

On-branch and consistent:

- States: `REAL_CANDIDATE → HUMAN_REVIEW → APPROVED_REAL_ACTION → REAL_EXECUTION → REAL_VERIFIED` (+ `REJECTED`).
- Legal transitions enforced in code (`ALLOWED_TRANSITIONS`).
- Elohim may create / enrich / rank; may **not** self-approve, execute, or declare verified.
- Explicit separation from the game engine: the engine may emit source event/opportunity IDs; it does not run the Work Packet state machine.

This layer is in better shape than the economic engine surface on the branch.

---

## 6. Play loop (`play.py`)

Present. It imports `EconomyEngine` and `create_candidate_from_game`. It supports:

- list opportunities
- take trade
- propose REAL_CANDIDATE work packet
- advance tick
- change marketplace fee

It cannot run against the branch as currently committed (missing engine).

---

## 7. Gaps vs. intended contracts (prompt assumptions)

| Intended contract | Branch reality |
|-------------------|----------------|
| Runnable deterministic EconomyEngine | Engine file missing |
| Discrete multi-tick transit state machine with `ARRIVED` | Enum has no `ARRIVED`; no tick-step transit API on branch |
| Price impact / depth rules fully specified in engine | Not inspectable on branch |
| Byte-for-byte proof from committed code | No proof artifact on branch |
| Test suite (25+ / 32) | No tests on branch |
| Transformation (scrap → copper_parts) | Types support transform fields; no implementation on branch |
| World Tick that only advances in-transit trades | Not present; must not invent against missing engine |

---

## 8. Recommended next actions (in order)

1. **Human gate (this document)** — Confirm that the missing `engine.py` / simulation / proof / tests are the first delivery target, not World Tick behaviour.
2. **Commit the actual engine** — Land the local `engine.py`, `seeded_random.py`, minimal tests, and a proof artifact onto `economic-game-mvp` so the branch becomes runnable and becomes the single source of truth.
3. **Re-recon after engine commit** — Re-run inventory against the now-complete branch; document the *actual* lifecycle transitions the engine performs (especially whether settlement is one-shot or multi-tick, and whether player trades move prices).
4. **Only then** — Issue a bounded World Tick prompt that implements against the verified lifecycle, without inventing NPC behaviour, transformations, or price-update rules that contradict the engine.

---

## 9. Explicit non-actions for this recon

- No production code written or modified.
- No World Tick implementation.
- No NPC economic-response logic.
- No UI, monetization, persistence layer, or Terracotta interface.
- No assumption that local sandbox files are already on the branch.

---

## 10. Bottom line

The branch contains a coherent **Work Packet** boundary and a **player-loop façade**, but it does **not** contain the deterministic economic engine that the façade and the play loop require. Any implementation prompt that assumes a complete, tick-advanced transit machine and specific price-update rules is currently building against an imagined repository.

**Stop here.** Next step is human review of this recon, then commit the missing engine so the repository becomes authoritative and runnable.
