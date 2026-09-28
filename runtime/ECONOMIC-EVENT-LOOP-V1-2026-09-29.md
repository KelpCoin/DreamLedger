# ECONOMIC EVENT LOOP V1

Purpose: move DreamLedger from architecture toward measurable economic events.

DISCOVER -> ADMIT -> MATCH -> TRAVERSE -> ACT -> SETTLE -> FULFILL -> VERIFY -> LEARN -> REPLICATE

Every meaningful automated operation should expose identity, state, evidence, cost, outcome, dependency state, and next action. Internal activity is not economic truth.

## Event contract

Where applicable:
- event_id
- correlation_id
- opportunity_id
- principal_id
- capability_id
- action_id
- source
- event_type
- state_before
- state_after
- authorization_state
- evidence_refs
- input_hash
- output_hash
- cost_nzd
- price_nzd
- settlement_state
- fulfillment_state
- verification_state
- occurred_at
- recorded_at
- dependency_state
- error_class

Events are append-oriented and independently auditable.

## Event families

Demand: DEMAND_OBSERVED, DEMAND_QUALIFIED, DEMAND_REJECTED, DEMAND_STALE.

Capability: CAPABILITY_MATCHED, CAPABILITY_PARTIAL, CAPABILITY_MISSING, FULFILLMENT_READY, FULFILLMENT_BLOCKED.

Traversability: AUTHORITY_CONFIRMED, AUTHORITY_UNKNOWN, ACCESS_CONFIRMED, ACCESS_BLOCKED, SETTLEMENT_PATH_CONFIRMED, DELIVERY_PATH_CONFIRMED, TRAVERSABLE, STRUCTURALLY_UNAVAILABLE.

Action: ACTION_PREPARED, ACTION_AUTHORIZED, ACTION_DISPATCHED, EXTERNAL_ACTION_SENT, EXTERNAL_RESULT_OBSERVED, ACTION_BLOCKED.

Commerce: OFFER_PRESENTED, CHECKOUT_STARTED, PAYMENT_ATTEMPTED, PAYMENT_SETTLED, PAYMENT_FAILED, BUYER_ATTRIBUTED.

Fulfillment: FULFILLMENT_STARTED, FULFILLMENT_COMPLETED, DELIVERY_RECORDED, BUYER_ACKNOWLEDGED, DISPUTE_OPENED, DISPUTE_RESOLVED.

Truth: EVIDENCE_CAPTURED, VERDICT_ISSUED, CONTRADICTION_FOUND, VERIFICATION_PASSED, VERIFICATION_FAILED, ECONOMIC_OUTCOME_VERIFIED.

DISPATCHED never implies EXTERNAL_ACTION_SENT. A checkout session or PaymentIntent never alone establishes a buyer or revenue.

## Automated response

EVENT -> POLICY/GATE -> NEXT STATE -> ACTION OR BLOCK -> NEW EVENT

DEMAND_QUALIFIED -> capability match.
CAPABILITY_MATCHED + complete fulfillment -> traversability.
TRAVERSABLE + explicit authorization -> executable frontier.
PAYMENT_SETTLED -> fulfillment.
FULFILLMENT_COMPLETED + evidence -> verification.
ECONOMIC_OUTCOME_VERIFIED -> replication candidate.

No event may manufacture missing evidence or authorization.

## Cross-substrate control

APIs emit canonical request, authorization, computation, result, metering, payment, delivery and verification events.

MCP is an adapter. MCP calls map to the same canonical request and outcome events as REST/API.

RAG emits source/evidence events. Retrieval is not truth. Preserve source identity, retrieval time, freshness, provenance and contradiction state.

KPIs:
VERIFIED_EXTERNAL_REVENUE
SETTLED_EXTERNAL_PAYMENTS
INDEPENDENT_EXTERNAL_BUYERS
VERIFIED_ECONOMIC_OUTCOMES
PAID_API_CALLS
PAID_MCP_CALLS
FULFILLED_AUTOMATED_REQUESTS
REQUEST_TO_PAID_CONVERSION
PAID_TO_VERIFIED_CONVERSION
CONTRIBUTION_MARGIN
LATENCY_TO_VERDICT
AUTOMATION_COMPLETION_RATE
HUMAN_GATE_RATE
REPEAT_USAGE

Operational:
OPPORTUNITIES_OBSERVED
QUALIFIABLE
CAPABILITY_MATCHED
TRAVERSABLE
EXECUTABLE
STRUCTURALLY_UNAVAILABLE
STALE
CONTRADICTIONS
UNKNOWN_RATE
DEPENDENCY_FAILURE_RATE

## Cloud-first operation

The cloud control plane remains authoritative when local capability is unavailable.

Local inference is a capability, not a prerequisite for truthful state. If local capability is unavailable, route to a verified cloud capability or record dependency failure and hold. Never claim local execution without evidence.

## Monetizable inversion

Customer request -> API/MCP admission -> evidence retrieval -> automated computation -> verdict/result -> usage event -> payment -> delivery -> verification.

Customers receive bounded outcomes, not internal agents, prompts, policies, secrets, Elohim access or private control-plane machinery.

## First-dollar sequence

REQUEST -> AUTOMATED RESULT -> EVIDENCE -> PRICE -> SETTLED PAYMENT -> DELIVERY -> VERIFIED OUTCOME.

Do not build an API catalogue before one outcome can close this loop.

## Substrate expansion

Connect the event model across opportunity acquisition, public retrieval, capability registry, fulfillment gates, dispatch semantics, Stripe settlement evidence, delivery evidence, Supabase economic state, Render health/deployment state, GitHub CI state, local capability availability, Dapr workflow state and MCP invocation state.

## Truth boundary

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

This contract changes instrumentation and control semantics, not those economic facts.
