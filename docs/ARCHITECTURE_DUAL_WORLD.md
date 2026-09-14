# DreamLedger Dual-World Architecture

**Status**: Design + Economic MVP proven  
**Date**: 2026-09-15  
**Principle**: The game must never pretend a game event is a real economic event.

---

## Core Insight

DreamLedger is not merely an arbitrage simulator.

It is a **game-shaped economic reconnaissance and work-generation system**.

The player experiences:

```
Explore → Spot discrepancy → Investigate → Formulate opportunity → Compete → Solve → Earn in-game consequences
```

Some discoveries can cross an explicit, human-gated boundary into real-world work:

```
Game discovery
    → Candidate real-world opportunity
    → Human verification
    → Real-world action
    → Real economic outcome
    → Evidence (BrownEye)
    → Game consequence
```

---

## Strict Separation of Worlds

```
GAME WORLD
   |
   | player discovers opportunity
   v
OPPORTUNITY CANDIDATE
   |
   | qualification / evidence
   v
REAL-WORLD WORK QUEUE
   |
   | human approval (required)
   v
REAL ECONOMIC ACTION
   |
   | actual buyer / seller / payment / fulfillment
   v
VERIFIED REAL OUTCOME
   |
   +----> BrownEye evidence (hostile accounting)
   |
   +----> DreamLedger game consequence
```

### Classification States (mandatory)

Every potential real-world opportunity must carry one of these states:

| State                | Meaning                                      | Auto-executable? |
|----------------------|----------------------------------------------|------------------|
| REAL_CANDIDATE       | Hypothesis formed from game discovery        | No               |
| HUMAN_REVIEW         | Queued for human inspection                  | No               |
| APPROVED_REAL_ACTION | Human has explicitly approved                | No (still gated) |
| REAL_EXECUTION       | Action is being performed externally         | N/A              |
| REAL_VERIFIED        | External economic outcome confirmed          | N/A              |
| REJECTED             | Discarded or failed verification             | N/A              |

**No automatic graduation from game event to real economic event is permitted.**

---

## Player-Facing Loop (the interesting part)

Do **not** tell the player: “Here are jobs to do.”

Tell the player:

> “You found something unusual. What do you think is happening?”

Progressive actions:

1. **INVESTIGATE** – gather more in-game / public signals  
2. **COMPARE** – cross-market, cross-time, cross-source  
3. **HYPOTHESIZE** – form a concrete economic claim  
4. **VALIDATE** – check against available evidence  
5. **PROPOSE** – create a work packet (still inside the game boundary)  
6. **REQUEST APPROVAL** – explicit human gate  
7. **EXECUTE** – only after approval, and only outside the game engine  
8. **VERIFY** – BrownEye records the real outcome; game receives only the verified consequence

This makes real work feel like the natural continuation of play rather than a bolted-on task manager.

---

## What the Economic MVP Already Proves

The deterministic engine in `game-economy-mvp/` demonstrates:

- Five markets, ten commodities, one avatar, twenty deterministic NPCs
- Imperfect information + risk-adjusted spread calculation
- Full transaction lifecycle with conservation of capital and inventory
- Same engine used by player and NPCs
- Single governance variable (marketplace fee) with observable effect
- Idempotency, authority limits, capacity constraints
- Machine-verifiable proof artifact from a fixed seed

It does **not** yet implement the real-world work queue. That is the next architectural layer.

---

## Integration Points (future, gated)

- **Stripe**: only for real economic actions that have passed HUMAN_REVIEW → APPROVED_REAL_ACTION. Never for in-game currency.
- **Supabase**: can hold the work-queue state and evidence references, but the game engine itself remains pure and deterministic.
- **BrownEye / Cortex**: receives only sanitized evidence IDs and economic facts after real verification. Never receives game secrets or credentials.
- **GitHub**: this repository is the collaboration surface. Both operators (and their Grok instances) can work against the same branch / PRs.

---

## Non-Goals (explicitly rejected for the game layer)

- Selling game currency for real money
- Real-money arbitrage or cash-out inside the game
- Tokens / NFTs as economic instruments
- Automatic execution of real-world trades from game events
- Any path that lets a game prediction become a claimed real economic event without external verification

---

## Killer Loop (target state)

```
Play → Notice → Investigate → Work → Earn → Verify → Improve → Play again
```

The game teaches the player to notice economically useful things.  
BrownEye remains the hostile, external source of commercial truth.  
Human approval is the hard boundary between the two worlds.

---

## Next Concrete Steps

1. Keep the economic MVP pure and deterministic (done).
2. Define the Work Packet schema (hypothesis, evidence required, counterparties, verification criteria).
3. Implement the classification state machine with human approval as a required transition.
4. Expose a read-only “Investigate in the real world” action that only creates a REAL_CANDIDATE work packet.
5. Wire BrownEye evidence ingestion only after a REAL_VERIFIED outcome exists.

Collaboration is open on the `economic-game-mvp` branch.
