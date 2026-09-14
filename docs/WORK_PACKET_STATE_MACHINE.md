# DreamLedger Work Packet State Machine

**Status:** Binding design for `economic-game-mvp`  
**Schema:** `docs/WORK_PACKET_SCHEMA.json`  
**Version:** 1.0

## Purpose

A Work Packet is the controlled handoff from a game-discovered opportunity to a possible piece of real-world work.

It is a hypothesis and work description, not proof of a real economic event and not an authorization to spend money.

Elohim may generate and refine Work Packets as the governor of the game discovery layer. Elohim does not receive authority to execute real-world actions merely by creating or approving a packet.

## State machine

```text
GAME DISCOVERY
     |
     v
REAL_CANDIDATE
     |
     | human submits for review
     v
HUMAN_REVIEW
     | \
     |  \
     |   +--------------------> REJECTED
     |
     | explicit human approval
     v
APPROVED_REAL_ACTION
     |
     | authorized external executor starts action
     v
REAL_EXECUTION
     | \
     |  \
     |   +--------------------> REJECTED
     |
     | verification criteria satisfied
     v
REAL_VERIFIED
```

## Legal transitions

| From | To | Required authority | Meaning |
|---|---|---|---|
| `REAL_CANDIDATE` | `HUMAN_REVIEW` | human/system queue | Packet is ready for inspection |
| `REAL_CANDIDATE` | `REJECTED` | human/system | Candidate is discarded before review |
| `HUMAN_REVIEW` | `APPROVED_REAL_ACTION` | explicit human approval | Human authorizes the described real-world action |
| `HUMAN_REVIEW` | `REJECTED` | human | Human declines the packet |
| `APPROVED_REAL_ACTION` | `REAL_EXECUTION` | authorized executor | External action has actually started |
| `APPROVED_REAL_ACTION` | `REJECTED` | authorized executor/system | Approved action cannot or will not be executed |
| `REAL_EXECUTION` | `REAL_VERIFIED` | verification authority | External outcome satisfies verification criteria |
| `REAL_EXECUTION` | `REJECTED` | verification authority/system | Execution failed or evidence is insufficient |

No other transitions are legal.

## Hard invariants

1. `REAL_CANDIDATE` is never evidence of real demand, revenue, payment, or profit.
2. `HUMAN_REVIEW` does not authorize execution.
3. `APPROVED_REAL_ACTION` requires an explicit human approval record.
4. A Work Packet cannot authorize Stripe, cash movement, purchasing, or external execution merely because its status changed.
5. `REAL_EXECUTION` means an external action actually began. It must not be used for simulation.
6. `REAL_VERIFIED` requires evidence satisfying the packet's verification criteria.
7. Simulation, NPC activity, game currency, and generated predictions remain inside the game/simulation boundary.
8. BrownEye receives sanitized evidence only after a real outcome reaches `REAL_VERIFIED`.
9. Elohim can create, classify, enrich, rank, and recommend Work Packets, but cannot self-approve a real-world action.
10. An LLM cannot manufacture verification by asserting that an outcome occurred.
11. Every transition is append-only in history and must identify the actor, timestamp, previous state, next state, and reason.
12. Replayed transition requests must be idempotent and must not create duplicate execution or verification events.

## Elohim's role

Elohim is the **governor of opportunity formation**, not the owner of commercial truth.

Elohim may:

- detect interesting game opportunities;
- create `REAL_CANDIDATE` packets;
- improve observations and hypotheses;
- identify evidence that should be collected;
- propose work and verification criteria;
- rank packets for human attention;
- reject malformed or internally contradictory candidates.

Elohim may not:

- approve its own packet for real execution;
- claim a real purchase or payment occurred;
- convert simulated results into revenue evidence;
- bypass `HUMAN_REVIEW`;
- create `REAL_EXECUTION` merely by issuing an LLM/tool call;
- mark `REAL_VERIFIED` without qualifying external evidence.

## Example

A player discovers that `copper_parts` have a large simulated spread between two game markets.

Elohim can create:

```text
REAL_CANDIDATE
claim: "A corresponding real-world price discrepancy may exist."
work: "Check current public prices and availability."
verification: "Independent evidence confirms the observed real-world prices."
```

A human may move it to `HUMAN_REVIEW`, inspect the packet, and either reject it or explicitly approve the proposed real-world investigation.

Only then can an external worker perform the approved action.

If the investigation produces qualifying evidence, the packet may reach `REAL_VERIFIED`. If not, it becomes `REJECTED`.

The original game event remains a game event throughout the entire process.

## Separation from game state

The deterministic EconomyEngine remains pure. It may create the source event and opportunity ID that a Work Packet references, but it does not execute the Work Packet state machine itself.

The Work Packet layer is an integration boundary between:

```text
DreamLedger game
      |
      v
Work Packet
      |
      v
Human authority
      |
      v
External real-world execution
      |
      v
Verified evidence
```

This boundary is mandatory and must remain explicit as the system grows.
