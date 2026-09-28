# FULFILLMENT STATUS AND OPPORTUNITY STATE
Date: 2026-09-29

## Purpose

Make fulfillment a first-class commercial state machine, not a label.

Inspired by production patterns in Medusa (fulfillment statuses, partial fulfillment, shipment, delivered) without adopting the full platform.

This document defines:

1. Canonical **FulfillmentStatus** enum
2. Canonical **OpportunityState** progression
3. Mapping between them
4. Rules that reject non-traversable work before routing
5. How partial fulfillment and human remainder are recorded

## FulfillmentStatus (canonical)

Status of a single deliverable or order line once an external commitment exists.

```
NOT_FULFILLABLE          # system cannot produce the required deliverable
AWAITING_INPUT           # blocked on buyer-supplied or external input
READY                    # inputs + capability + authority present; not yet started
IN_PROGRESS              # execution started; no completable packet yet
PARTIALLY_FULFILLED      # some atomic deliverables done; remainder remains
FULFILLED                # all automated + designed human-gate deliverables complete
SHIPPED                  # package / packet delivered to buyer or designated channel
DELIVERED                # buyer-confirmed receipt or independent delivery evidence
VERIFIED                 # external outcome evidenced (payment settled + fulfillment confirmed)
CANCELED                 # abandoned or rejected; terminal
FAILED                   # execution failed; terminal pending review
```

Notes:

- `FULFILLED` does **not** imply payment or verified outcome.
- `VERIFIED` is the only state that may increment the FIRST-DOLLAR scoreboard.
- `PARTIALLY_FULFILLED` must always carry an explicit human-remainder description.

## OpportunityState (canonical)

Lifecycle of an opportunity from discovery to verified result.

```
DISCOVERED               # observed demand / source
QUALIFIED                # passed basic legitimacy and jurisdiction filters
DECOMPOSED               # split into atomic deliverables
CAPABILITY_MATCHED       # every deliverable mapped to a registered capability or human gate
TRAVERSABLE              # access + authority + validation predicates exist for all deliverables
AUTHORIZED               # A3 / human authorization granted where required
EXECUTED                 # worker ran; traces recorded
PAID                     # independent external settlement observed
FULFILLED                # fulfillment status reached FULFILLED or better for committed lines
VERIFIED                 # payment + fulfillment + evidence joined; scoreboard eligible
BLOCKED                  # cannot proceed; reason recorded (missing access, authority, validation, margin, etc.)
EXPIRED                  # no longer actionable
REJECTED                 # deliberately not pursued
```

Promotion rule (must be mechanical):

```
DISCOVERED
→ CAPABLE          (all deliverables have capability or explicit human gate)
→ TRAVERSABLE      (access + authority + validation present)
→ AUTHORIZED       (A3 gate where required)
→ EXECUTED
→ PAID
→ FULFILLED
→ VERIFIED
```

No state may skip. Internal activity does not advance past EXECUTED without external evidence.

## Mapping: OpportunityState ↔ FulfillmentStatus

| OpportunityState | Allowed FulfillmentStatus values |
|------------------|----------------------------------|
| DISCOVERED / QUALIFIED / DECOMPOSED | none (no commitment yet) |
| CAPABILITY_MATCHED / TRAVERSABLE | NOT_FULFILLABLE, AWAITING_INPUT, READY |
| AUTHORIZED | READY, IN_PROGRESS |
| EXECUTED | IN_PROGRESS, PARTIALLY_FULFILLED, FULFILLED, FAILED |
| PAID | same as EXECUTED + SHIPPED |
| FULFILLED | FULFILLED, SHIPPED, DELIVERED |
| VERIFIED | VERIFIED |
| BLOCKED / EXPIRED / REJECTED | CANCELED or FAILED |

## Required fields on every opportunity once DECOMPOSED

- `deliverables[]` — atomic units
- `capability_id` or `human_gate: true` per deliverable
- `input_schema` / required buyer inputs
- `access_path` and `authority` per capability
- `validation_predicate`
- `human_remainder` (null only if fully automated and validated)
- `estimated_human_minutes`
- `expected_margin_after_compute` (kill if negative or insufficient)

## Rejection before routing

Reject (set BLOCKED or REJECTED) when any of:

1. Required deliverable has no registered capability and no designed human gate.
2. Required input has no legitimate access path.
3. Required authority cannot be obtained under A0→A3 rules.
4. Validation predicate cannot be evaluated.
5. Expected contribution margin after compute cannot cover cost.
6. Effect tools (payment, statutory submission, outcome write) would be ungrounded under ledger-vouching.

## Partial fulfillment contract

When status = PARTIALLY_FULFILLED:

- List completed deliverables with evidence pointers / `sha_canon`.
- List remaining deliverables with exact human task description.
- Estimate remaining human minutes.
- Package the remainder as the smallest possible handoff (pivot 15–16).
- Never describe the opportunity as "autonomously fulfilled".

## Public offer contract (required for any purchasable surface)

Every public offer must state in customer language:

1. What the buyer receives
2. What inputs the buyer supplies
3. What is automated
4. What requires human action
5. How validation occurs
6. What is excluded
7. What constitutes delivery
8. What constitutes completion
9. What evidence exists afterward

These statements must themselves be able to pass ledger-vouching when asserted.

## FIRST-DOLLAR scoreboard eligibility

Only opportunities that reach **VERIFIED** with:

- independent external payment evidence
- fulfillment status ≥ DELIVERED or explicit buyer confirmation
- grounded provenance (`sha_canon` join)

may increment:

- independent buyers
- settled external payments
- fulfilled paid orders
- verified external outcomes
- repeat purchasers
- contribution margin
- human minutes per verified outcome

Internal activity, opportunity counts, silo volume, and ungrounded claims never increment the scoreboard.

## Implementation note

This is a contract document. Implementation may live in existing opportunity / economic action tables without new economic schema mutations until the first live path needs them. Prefer adding status columns and predicates over new tables.

## Success criterion

An opportunity is routable only when it is TRAVERSABLE.  
A commercial claim is publishable only when fulfillment status and opportunity state are consistent and grounded.  
A verified outcome is countable only when payment + fulfillment + evidence are joined under the rules above.
