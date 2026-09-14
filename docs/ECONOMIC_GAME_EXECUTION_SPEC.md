# Economic Game MVP Execution Specification

Status: EXECUTION_TARGET
Branch: economic-game-mvp
Date: 2026-09-15

This document records the locked execution sequence for the deterministic economic-game MVP. It is a specification and evidence contract, not a claim that the implementation has passed its gates.

## Hard boundary

DreamLedger game state is simulated state. It must never be represented as real economic activity. Any transition toward real-world work requires an explicit human gate.

Required real-world sequence:

REAL_CANDIDATE -> HUMAN_REVIEW -> APPROVED_REAL_ACTION -> REAL_EXECUTION -> REAL_VERIFIED

No automatic graduation is permitted.

## Priority 1: deterministic foundation

A clean checkout of `economic-game-mvp` must:

1. Resolve all economic engine imports from committed files.
2. Pass the existing deterministic test suite.
3. Generate the proof artifact with seed `123456`.
4. Generate the proof twice with byte-identical output.
5. Match the committed proof artifact.
6. Launch the player CLI.
7. Import the Work Packet component and initialize it in `REAL_CANDIDATE`.
8. Require no database, network, GPU, secrets, absolute paths, UUID-dependent economic state, wall-clock time, or floating-point currency.

The proof is an execution witness. It must be reproducible from canonical deterministic inputs, not merely a final-state dump.

## Event-sourced proof contract

Canonical economic state must be reconstructible from the ordered event log through a deterministic state transition function.

`state_n = evolve(evolve(...evolve(initial, event_1), event_2)..., event_n)`

The proof artifact should contain:

- seed
- deterministic context/version
- canonical event log
- final state hash
- event-chain hash
- canonical output metadata

Canonical JSON must use sorted keys and fixed-point integer monetary values. Deterministic simulation events must not contain wall-clock timestamps.

## Priority 2: transformation and world pressure

Implement only after Priority 1 passes.

Transformation contract:

- input: 10 `scrap`
- output: 8 `copper_parts`
- fixed deterministic cost
- integer tick duration
- deterministic facility/location
- zero failure probability in v0.1
- explicit actor authorization
- same engine authority model as trading

World events must be generated from deterministic seeded world state and recorded as first-class events. They must alter conditions, not secretly force prices or outcomes.

NPC response must be caused by individual NPC observation, thresholds, capital allocation, route/risk preferences, and recorded actions. No hidden balancing or player-specific rubber-banding.

Required replay gate:

- same seed
- same authorized inputs
- same world-event sequence
- same NPC actions
- same final state
- same canonical proof bytes

## Priority 3: playable UI

Only after Priorities 1 and 2 pass.

Minimal vanilla UI. No LLM in the economic loop. No duplicated economic logic in the browser.

Seven panels:

1. Markets
2. Opportunities
3. Inventory
4. Capital
5. Active Shipments
6. Reputation
7. World Events

Central player question:

> Which opportunity are you willing to risk your capital on?

Completed trades must expose their deterministic proof artifact directly.

## Commercial gate

No paid offer, real buyer test, Stripe action, or monetization work is part of this execution sequence. Commercial work begins only after the game artifact is reproducible, playable, and human-validated.

## Current repository truth

The architecture document is present on this branch and identifies the economic MVP as deterministic and pure. The repository currently does not contain a file named `terracotta_proxy_mvp.py`, and no claim about that proxy is promoted to verified implementation by this specification.

## Acceptance status

PRIORITY_1: NOT VERIFIED HERE
PRIORITY_2: NOT STARTED FROM VERIFIED PRIORITY_1
PRIORITY_3: NOT STARTED FROM VERIFIED PRIORITY_2
COMMERCIALIZATION: BLOCKED BY DESIGN UNTIL 1-3 PASS
