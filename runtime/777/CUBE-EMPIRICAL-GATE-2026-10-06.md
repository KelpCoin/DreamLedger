# CUBE EMPIRICAL GATE — 2026-10-06

Status: EXECUTION ATTEMPTED, SCALE LOCKED

## Rule

The CUBE swarm may scale only after REAL observed traces show:
1. CUBE cooperative success > 6.7% Molt Dynamics reference.
2. CUBE cooperative success > matched single-cell control.
3. Pressure-field comparison is measured from actual runs, not inferred from the paper.
4. Missing evidence means HOLD/NO-GO, never simulated PASS.

## Required trace

`runtime/777/cube-swarm-traces.jsonl`

Each JSONL record:
`task_id, strategy, success`
Optional: `cell_id, action_id, timestamp`.

Accepted strategies:
- `single_cell`
- `cube_swarm`
- `pressure_field`
- `conversation`
- `hierarchy`

## Current result

The repository contains CUBE contracts and swarm-control specifications, but no observed CUBE execution trace file was found. Therefore the empirical gate cannot honestly produce a success rate.

This is an execution blocker, not a design success.

## MAST pre-mortem

The existing control-plane contract already contains useful containment primitives: explicit authority classes, Gauntlet quarantine, Truth Oracle evidence boundaries, staged roles, and disagreement-preserving synthesis. The pre-mortem should specifically test:
- inter-agent misalignment
- premature convergence / diversity collapse
- unverifiable claims
- shared-state contamination
- authority escalation
- coordination overhead exceeding single-cell value
- failure propagation
- credit misassignment
- stale evidence
- external-action confusion

No production scale-up is permitted until the runtime produces the trace required above.

## Economic boundary

VERIFIED_EXTERNAL_REVENUE: NZ$0.00
INDEPENDENT_EXTERNAL_BUYERS: 0
SETTLED_EXTERNAL_PAYMENTS: 0
VERIFIED_ECONOMIC_OUTCOMES: 0

No benchmark result changes that scoreboard.
