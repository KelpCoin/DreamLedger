# SUBSTRATE-AWARENESS-IMPLEMENTATION-PLAN-v1

Status: EXECUTION PLAN
Parent: SUBSTRATE-AWARENESS-CONTRACT-v1

## Objective

Turn substrate awareness into measured runtime economics without creating a second economic system.

The implementation is deliberately narrow. First prove instrumentation on one existing economic path. Then expand only when the measurements change a real decision.

## Phase 0: Measurement boundary

Instrument the existing economic action/execution/evidence path with a correlation-preserving cost envelope.

For every model/tool operation attributable to an economic unit, capture:

ECONOMIC_TRACE_ID
OPPORTUNITY_ID
ACTION_ID
MODEL_PROVIDER
MODEL
STARTED_AT
COMPLETED_AT
INPUT_TOKENS_WHEN_AVAILABLE
OUTPUT_TOKENS_WHEN_AVAILABLE
TOOL_CALL_COUNT
ESTIMATED_PROVIDER_COST
ACTUAL_PROVIDER_COST_WHEN_AVAILABLE
COMPUTE_COST_STATUS

COMPUTE_COST_STATUS:
KNOWN
ESTIMATED
UNKNOWN
NOT_APPLICABLE

Do not invent provider costs. UNKNOWN remains UNKNOWN.

## Phase 1: Cost attribution

Compute:

AGENT_COST_SEARCH
AGENT_COST_VERIFICATION
AGENT_COST_PREPARATION
AGENT_COST_EXECUTION

Then:

AGENT_COST_TOTAL = sum(known attributable costs)

And:

CONTRIBUTION_PRE_AGENT_COST
CONTRIBUTION_POST_AGENT_COST

The runtime must be able to answer:

“How much did this economic attempt cost the operator to think about?”

without counting unrelated background activity.

## Phase 2: Dependency cut set

For the currently active transaction path, record only dependencies that can actually stop the path.

For each dependency:

DEPENDENCY_ID
PROVIDER
SERVICE
ROLE
FAILURE_MODE
CURRENT_COST
ALTERNATIVE_COUNT
SWITCHING_COST
LAST_VERIFIED
NEXT_RECHECK

Derive:

CRITICAL_DEPENDENCY = dependency whose failure prevents completion.
DEPENDENCY_CUT_SET = smallest set whose simultaneous availability is necessary for completion.

This is a path property, not a global vendor inventory.

## Phase 3: Runtime integrity

Use existing runtime telemetry to detect deviations from the execution packet.

Compare expected versus observed:

TOOLS
DESTINATIONS
CREDENTIAL_SCOPE
WRITE_TARGETS
STATE_TRANSITIONS
REQUEST_VOLUME
PROVIDERS
REPOSITORY_CHANGES

Anomaly severity:

INFO
WARN
HIGH
CRITICAL

HIGH or CRITICAL anomalies affecting an economic path cause execution quarantine pending resolution.

A telemetry anomaly does not alter revenue truth.

## Phase 4: Buyer composition

At transaction/settlement observation time classify:

BUYER_CLASS:
HUMAN
BUSINESS
AGENT
MACHINE_SYSTEM
MIXED
UNKNOWN

Keep this orthogonal to:

BUYER_VERIFIED
PAYMENT_SETTLED
FULFILLMENT_VERIFIED
REVENUE_VERIFIED

Buyer class is descriptive metadata, never evidence of payment.

## Phase 5: Substrate-adjusted economics

For an opportunity with sufficient observations:

SUBSTRATE_ADJUSTED_CONTRIBUTION =
SETTLED_REVENUE
- FULFILLMENT_COST
- PAYMENT_COST
- AGENT_COST
- PLATFORM_RENT
- REQUIRED_INSURANCE_COST
- EXPECTED_UNINSURED_RISK_COST
- TAX_LIABILITY_WHERE_KNOWN

Unknown costs remain explicitly unknown.

A contribution calculation with material UNKNOWN terms is PARTIAL, not VERIFIED.

## Phase 6: Decision hooks

Do not build a new orchestrator.

Expose substrate results to the existing routing decision as advisory state:

SUBSTRATE_STATUS
SUBSTRATE_IMPACT
RECHECK_REQUIRED
ROUTING_ACTION

Routing may be:

CONTINUE
REPRICE
REROUTE
REVERIFY
PAUSE
HUMAN_REVIEW
ABANDON

No substrate signal may authorize spending or external action by itself.

## Phase 7: Only then add slow substrates

After the above measurements work on a real path:

INSURABILITY
REPUTATION_PORTABILITY
FISCAL_EXPOSURE
CONCENTRATION/MACRO

These are not first because they are less important. They are later because their measurements are slower, more context-dependent, and less useful before the operator has a known unit of economic activity.

## Acceptance tests

1. One economic attempt has a complete ECONOMIC_TRACE_ID.
2. Search and verification compute are attributable separately.
3. Known compute costs flow into contribution.
4. Unknown compute cost remains UNKNOWN.
5. Dependency cut set identifies actual path blockers.
6. An unexpected tool/destination/state transition produces an anomaly.
7. HIGH/CRITICAL anomaly quarantines affected execution.
8. Buyer class is recorded without changing truth state.
9. Substrate review can request REVERIFY without creating a new outcome.
10. No substrate observation can create VERIFIED revenue.
11. No background model usage is attributed to an unrelated opportunity.
12. Existing economic truth counts remain unchanged by instrumentation alone.

## Economic stop rule

Do not continue substrate engineering merely because more substrate dimensions exist.

Continue only when a measurement:

A. changes an actual routing decision,
B. changes contribution economics,
C. prevents a real execution failure, or
D. closes a demonstrated substrate gap.

Otherwise leave the dimension uninstrumented.

## First live test

Select the currently active economic opportunity.

Run one complete trace from first search/analysis operation through the next externally meaningful step.

Produce:

TRACE_ID
REVENUE
AGENT_COST
FULFILLMENT_COST
PAYMENT_COST
PLATFORM_RENT
INSURANCE_COST
TAX_STATUS
SUBSTRATE_ADJUSTED_CONTRIBUTION
DEPENDENCY_CUT_SET
RUNTIME_INTEGRITY
BUYER_CLASS
DECISION

If there is no active opportunity, emit NO_LIVE_OPPORTUNITY and do not manufacture a test transaction.

## Definition of done

The substrate layer is useful when the operator can distinguish, from recorded evidence:

“I failed to find/close/fulfill the opportunity”

from:

“The opportunity depended on a substrate condition that was unavailable or uneconomic.”

That distinction must be machine-observable, not merely written in a report.
