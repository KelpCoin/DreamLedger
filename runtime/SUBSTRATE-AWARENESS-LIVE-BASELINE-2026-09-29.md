# SUBSTRATE-AWARENESS-LIVE-BASELINE-2026-09-29

Status: LIVE BASELINE
Purpose: record the first substrate finding from the existing runtime before adding instrumentation.

## Finding 1: compute substrate is already failing on an economic path

Observed in `public.economic_actions`:

- action_id: `45f98b88-78dd-4549-b5bb-b6f4a1a7482e`
- action_type: `BUILD_EXECUTION_PACKET`
- authorization_state: `AUTHORIZED`
- execution_state: `FAILED`
- created_at: `2026-09-27 05:05:04.579124+00`
- failure chain: `economic-fulfillment-dispatch HTTP 502`
- worker error: `WORKER_FAILED`
- resource condition: `WORKER_RESOURCE_LIMIT`
- reported cause: insufficient compute resources

This is not a macro forecast. It is an observed runtime failure.

Therefore COMPUTE_ECONOMICS is not a future-only substrate dimension. It has already affected the economic execution path.

## Finding 2: current schema can carry most substrate observations without a new economic ledger

Existing surfaces inspected:

- `economic_actions.metadata`
- `economic_actions.payload`
- `economic_actions.decision_facts`
- `economic_execution_packets.evidence_plan`
- `economic_execution_packets.budget_policy`
- `economic_execution_packets.kill_conditions`
- `economic_events.evidence`
- `economic_events.payload_hash`
- `telemetry_events.payload`
- `economic_silo_loops.evidence`
- `economic_silo_loops.provenance`

No existing canonical `ECONOMIC_TRACE_ID` column was found in these inspected tables.

Conclusion: do not create a second economic ledger. Use the existing telemetry/economic surfaces for the first measurement envelope, with a correlation identifier carried in payload/metadata until repeated live traces prove that a dedicated schema field is necessary.

## Finding 3: agent-to-agent demand already exists as a candidate class, not as verified demand

The current `cube_toll_registry` contains agent-buyer candidates such as:

- `toll-0001-identity-check`
- `toll-0002-identity-verify`
- `toll-0003-identity-normalize`
- `toll-0004-identity-compare`

They are PRIVATE, CANDIDATE, UNVERIFIED, with zero external buyers, zero settled payments, zero fulfilled orders, and zero independent proofs.

Therefore BUYER_CLASS=AGENT is currently an opportunity descriptor only. It must not be treated as evidence of agentic demand.

## Finding 4: no current verified economic outcome was identified

The inspected runtime remains consistent with:

- verified external revenue: NZ$0.00
- settled external payments: 0
- independent external buyers: 0

The substrate layer must not change these truth values.

## Immediate implementation decision

The first substrate runtime increment is COMPUTE_TRACE, not macro monitoring.

Reason:

1. compute failure has already occurred on a live economic path;
2. the current runtime does not yet expose attributable model/tool cost as a canonical economic measurement;
3. compute cost can change routing and contribution economics immediately;
4. macro, insurance, reputation, and fiscal observations cannot compensate for missing unit-level cost attribution.

## Required next trace

For the next real economic attempt, capture:

ECONOMIC_TRACE_ID
ACTION_ID
OPPORTUNITY_ID when available
MODEL_PROVIDER
MODEL
STARTED_AT
COMPLETED_AT
INPUT_TOKENS when available
OUTPUT_TOKENS when available
TOOL_CALL_COUNT
ESTIMATED_PROVIDER_COST
ACTUAL_PROVIDER_COST when available
COMPUTE_COST_STATUS
WORKER_RESOURCE_STATUS
DEPENDENCY_CUT_SET
RUNTIME_INTEGRITY

Unknown remains UNKNOWN.

No synthetic transaction is permitted to create the trace.

## Stop condition

If the next real attempt cannot produce a useful compute trace, fix attribution at the existing telemetry boundary before adding any other substrate dimension.

