# SUBSTRATE-AWARENESS-IMPLEMENTATION-PLAN-v1.1

Status: EXECUTION AMENDMENT
Parent: SUBSTRATE-AWARENESS-IMPLEMENTATION-PLAN-v1
Live baseline: runtime/SUBSTRATE-AWARENESS-LIVE-BASELINE-2026-09-29.md

## Change in priority

The substrate work is now evidence-led.

A real economic action has already failed with `WORKER_RESOURCE_LIMIT` during fulfillment dispatch. Therefore compute substrate measurement moves ahead of macro, insurance, reputation, and fiscal monitoring.

Do not build broad macro surveillance first.

## Existing-runtime strategy

Do not create a parallel economic ledger.

First measurement must attach to existing:

- `economic_actions`
- `economic_execution_packets`
- `economic_events`
- `telemetry_events`
- `economic_silo_loops`

Use the existing JSON payload/metadata surfaces for the first trace envelope.

A dedicated trace table or first-class columns are justified only after repeated live attempts demonstrate that JSON-carried correlation cannot reliably support attribution, querying, or enforcement.

## COMPUTE_TRACE v0

For each model/tool operation that is attributable to an economic attempt, emit a telemetry event containing:

```
event_type = ECONOMIC_COMPUTE_TRACE
economic_trace_id
action_id
opportunity_id
phase
model_provider
model
started_at
completed_at
input_tokens
output_tokens
tool_call_count
estimated_provider_cost
actual_provider_cost
compute_cost_status
worker_resource_status
dependency_ids
```

Allowed `compute_cost_status`:

- KNOWN
- ESTIMATED
- UNKNOWN
- NOT_APPLICABLE

Cost values must never be fabricated.

If the provider does not expose a reliable cost, record UNKNOWN.

## Attribution rules

1. Every trace belongs to exactly one economic attempt.
2. Background model activity is not attributable unless a causal correlation exists.
3. A failed worker is still an economic cost event if the work was performed for the attempt.
4. Resource exhaustion is an observable substrate failure, not merely an application error.
5. A compute failure must not mutate revenue truth.
6. A compute trace must not authorize execution.
7. The same trace may support routing, contribution accounting, and post-failure classification.

## Runtime integrity binding

For execution-capable attempts, correlate compute traces with the existing execution packet.

Compare:

TOOLS
DESTINATIONS
CREDENTIAL_SCOPE
WRITE_TARGETS
STATE_TRANSITIONS
REQUEST_VOLUME
PROVIDERS

If observed behavior diverges materially from the packet, classify the anomaly through the existing runtime integrity path.

Do not create a second authorization mechanism.

## Dependency cut set

For the traced path, derive only dependencies whose failure can stop the actual path.

Initial dependency classes:

- model provider
- payment rail
- fulfillment worker
- platform/API
- required external data source

Record:

DEPENDENCY_ID
ROLE
FAILURE_MODE
CURRENT_COST
ALTERNATIVE_COUNT
SWITCHING_COST
LAST_VERIFIED
NEXT_RECHECK

If a dependency is unknown, say UNKNOWN.

## Contribution

Where enough observations exist:

```
SUBSTRATE_ADJUSTED_CONTRIBUTION =
SETTLED_REVENUE
- FULFILLMENT_COST
- PAYMENT_COST
- AGENT_COST
- PLATFORM_RENT
- REQUIRED_INSURANCE_COST
- EXPECTED_UNINSURED_RISK_COST
- TAX_LIABILITY_WHERE_KNOWN
```

Unknown terms remain unknown.

Do not convert an incomplete calculation into a verified margin.

## Failure classification

Every completed attempt should distinguish:

OPERATOR_FAILURE
SUBSTRATE_FAILURE
DEMAND_FAILURE
SETTLEMENT_FAILURE
FULFILLMENT_FAILURE
UNKNOWN

The observed `WORKER_RESOURCE_LIMIT` event is the first concrete candidate for SUBSTRATE_FAILURE, subject to path-level confirmation.

## Routing consequence

Substrate awareness is advisory.

Allowed outputs:

CONTINUE
REPRICE
REROUTE
REVERIFY
PAUSE
HUMAN_REVIEW
ABANDON

A substrate observation cannot itself create:

AUTHORIZED
EXECUTING
SUCCEEDED
VERIFIED_REVENUE

## First execution target

Use the next genuine economic attempt.

Do not manufacture a transaction.

If no genuine attempt exists:

NO_LIVE_OPPORTUNITY

and stop the live test.

## Acceptance tests for v1.1

1. A real economic attempt receives one stable economic_trace_id.
2. Multiple model/tool events for that attempt share the trace.
3. Unrelated background activity is excluded.
4. Worker resource failure is recorded as a substrate observation.
5. Known compute cost reaches contribution accounting.
6. Unknown compute cost stays UNKNOWN.
7. Dependency cut set contains only path blockers.
8. Runtime anomaly does not silently authorize or alter execution.
9. Buyer class remains descriptive.
10. Verified revenue/payment counts remain unchanged by instrumentation.
11. No synthetic buyer, payment, demand, or transaction is created.
12. A failed attempt can be classified as operator/substrate/demand/settlement/fulfillment/unknown.

## Economic stop rule

Stop expanding substrate scope until COMPUTE_TRACE has produced at least one useful real-path measurement.

Expand to CHOKEPOINT_DEPENDENCY, INSURABILITY, REPUTATION_PORTABILITY, FISCAL_EXPOSURE, and macro-financial monitoring only when a live decision requires them or a demonstrated failure shows that the missing measurement changes the outcome.

