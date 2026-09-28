# ECONOMIC COMPUTE TRACE BRIDGE v1

Status: NEXT EXECUTION GATE
Date: 2026-09-29

## Purpose

Attach measurable agent and worker cost to a genuine economic execution without creating a second ledger.

The bridge answers one question:

> What did this economic action consume, and did that consumption alter the action's economic viability?

This is instrumentation, not accounting truth.

## Existing-state rule

Use the existing economic action, opportunity, execution-packet, transition, evidence, and outcome machinery.

Do not create a parallel economic ledger.

Do not promote trace observations into revenue, buyer, settlement, fulfillment, or VERIFIED truth.

## Trace identity

Every instrumented execution receives one immutable:

`ECONOMIC_TRACE_ID`

The same trace identifier follows the action through:

`INTAKE -> REASONING -> TOOL USE -> EXECUTION PACKET -> WORKER -> FULFILLMENT -> RESULT`

Where an existing `ACTION_ID` exists, bind:

`ECONOMIC_TRACE_ID -> ACTION_ID -> OPPORTUNITY_ID`

A retry is a new execution observation under the same opportunity/action lineage, not a mutation of the original trace.

## Minimum trace envelope

```json
{
  "economic_trace_id": "ET-...",
  "action_id": "EA-...",
  "opportunity_id": "OP-...",
  "phase": "EXECUTION",
  "model_provider": "UNRECORDED",
  "model": "UNRECORDED",
  "started_at": "...",
  "completed_at": "...",
  "input_tokens": null,
  "output_tokens": null,
  "tool_call_count": 0,
  "estimated_provider_cost": null,
  "actual_provider_cost": null,
  "compute_cost_status": "UNKNOWN",
  "worker_resource_status": "UNKNOWN",
  "dependency_cut_set": [],
  "runtime_integrity": "UNKNOWN"
}
```

Unknown is valid. Invented cost is not.

## Phase boundaries

Capture four boundaries where the runtime can observe them:

1. `START`
2. `MODEL/TOOL`
3. `WORKER`
4. `END`

The trace must survive failures.

A failed action with a complete resource observation is more useful than a successful action with no cost attribution.

## Cost attribution

Use the strongest available evidence in this order:

1. provider-reported actual usage/cost;
2. runtime-recorded usage multiplied by a versioned provider price;
3. measured local compute cost where applicable;
4. bounded estimate explicitly marked ESTIMATED;
5. UNKNOWN.

Never convert UNKNOWN into zero.

For every cost value retain its provenance:

`COST_SOURCE`
`PRICE_VERSION`
`OBSERVED_AT`
`COST_STATUS`

## Worker attribution

Worker capacity is distinct from provider inference.

Record:

`WORKER_RESOURCE_STATUS = AVAILABLE | CONSTRAINED | EXHAUSTED | FAILED | UNKNOWN`

If the worker fails, retain:

`FAILURE_CLASS`
`HTTP_STATUS`
`RESOURCE_CONDITION`
`DEPENDENCY_ID`

The known `HTTP 502 / WORKER_RESOURCE_LIMIT` event is the first regression fixture.

## Contribution bridge

For an opportunity with a known gross amount:

`SUBSTRATE_ADJUSTED_CONTRIBUTION = GROSS_RECEIPT - FULFILLMENT_COST - AGENT_COST - PAYMENT_COST - PLATFORM_RENT - REQUIRED_INSURANCE_COST - EXPECTED_UNINSURED_RISK_COST - KNOWN_TAX_LIABILITY`

For the trace itself:

`AGENT_COST = PROVIDER_COST + MEASURED_LOCAL_COMPUTE_COST`

If a component is unknown, contribution remains UNKNOWN rather than being optimistically calculated.

This prevents cheap-looking searches from hiding unmeasured cognition cost.

## Search economics

Bounded opportunity discovery must accumulate trace cost across the search lineage.

Required derived observations:

`SEARCH_TRACE_COUNT`
`TOTAL_AGENT_COST`
`TOTAL_WORKER_COST`
`TOTAL_TOOL_CALLS`
`VIABLE_OPPORTUNITIES_FOUND`
`COST_PER_VIABLE_OPPORTUNITY`

Do not call this customer acquisition cost unless an external transaction establishes the relevant denominator.

Before first revenue, this is an internal operating cost observation only.

## Dependency cut set derivation

Start from actual failure evidence.

For every failed or materially degraded trace:

1. identify the first failed dependency;
2. identify downstream functions blocked by it;
3. record available alternatives;
4. record whether alternatives are contractually permitted;
5. record switching time/cost;
6. test the next live path against that dependency.

Do not label a provider a chokepoint merely because it is popular.

## Routing hook

The trace bridge may emit advisory substrate actions:

`CONTINUE`
`REPRICE`
`REROUTE`
`REVERIFY`
`PAUSE`
`HUMAN_REVIEW`
`ABANDON`

The existing authorization layer remains the execution authority.

A trace cannot authorize itself.

## Integrity binding

Bind each trace to the action's:

`REQUEST_HASH`
`AUTHORIZATION_STATE`
`EXECUTION_STATE`
`RUNTIME_INTEGRITY`

Reject or quarantine when:

- trace identity changes mid-action;
- action identity does not match trace binding;
- execution occurs without the corresponding authorization;
- privileged tool use has no trace;
- trace reports success while the underlying action reports failure;
- evidence chronology becomes impossible.

## Retry semantics

Retries must never erase failure evidence.

```
ET-001  -> worker constrained -> FAILED
ET-002  -> reroute -> SUCCEEDED
```

Both remain.

Economic success is determined by the existing external-truth machinery, not by `ET-002`.

## First live acceptance path

Use the next genuine economic execution, not a synthetic benchmark.

Required proof chain:

`ACTION_ID
 -> ECONOMIC_TRACE_ID
 -> MODEL/TOOL OBSERVATION
 -> WORKER OBSERVATION
 -> COST OBSERVATION
 -> RESULT
 -> CONTRIBUTION IMPACT
`

The implementation passes when the runtime can answer:

1. what computation occurred;
2. what it cost or why cost is unknown;
3. whether worker capacity constrained it;
4. which external dependency mattered;
5. whether that changed routing;
6. whether any external economic event occurred.

Question 6 must remain independently answered.

## Regression cases

A test suite must prove:

### T1 Missing trace
Privileged execution without a trace is rejected or quarantined.

### T2 Unknown cost
Missing provider billing data produces UNKNOWN, never zero.

### T3 Worker failure
The known resource-limit failure records the worker condition and preserves the failed action.

### T4 Retry preservation
A reroute/retry produces a second trace without deleting T3.

### T5 Cost impact
A materially higher observed compute cost changes contribution when the opportunity has a defined economic boundary.

### T6 No economic promotion
A successful compute trace does not create revenue, buyer, settlement, fulfillment, or VERIFIED status.

### T7 Integrity mismatch
A trace/action mismatch blocks affected privileged execution.

### T8 Search accumulation
Multiple discovery traces aggregate into an internal search-cost observation.

### T9 External truth separation
A trace with zero external buyer evidence remains economically UNVERIFIED.

### T10 Recovery
A dependency recovery can produce CONTINUE/REROUTE only after fresh observation.

## Failure classification

Classify failures as:

`TRACE_MISSING`
`COST_UNKNOWN`
`PROVIDER_FAILURE`
`WORKER_RESOURCE_LIMIT`
`WORKER_FAILURE`
`DEPENDENCY_FAILURE`
`INTEGRITY_FAILURE`
`AUTHORIZATION_MISMATCH`
`ROUTING_FAILURE`

Do not collapse infrastructure failure into demand failure.

Do not collapse compute cost into fulfillment cost.

Do not collapse trace success into economic success.

## Implementation stop condition

Stop substrate expansion after this bridge demonstrates one genuine end-to-end path with:

- immutable trace identity;
- observed compute/resource data;
- attributable or explicitly unknown cost;
- dependency identification;
- contribution impact;
- bounded routing response;
- preserved failure history;
- unchanged external economic truth unless independently evidenced.

Then return to the economic mission.

The next unit of work is not another substrate document. It is wiring this trace boundary into the existing execution path and producing the first real trace.
