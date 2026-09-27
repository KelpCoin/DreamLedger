# Agent Bridge: Cube -> Elohim -> Gauntlet -> Action -> Truth

## Purpose

Every consequential cloud-side agent operation must pass through the same governed bridge.

The commerce layer is a workload. CUBE is the intake/control surface. Elohim is the proposal/reasoning role. Gauntlet is the adversarial/policy gate. Truth Oracle is the verification layer. External execution is downstream of authorization.

## Required lifecycle

WORLD/SIGNAL
  -> CUBE INTAKE
  -> CUBE QUALIFICATION
  -> ELOHIM PROPOSAL
  -> GAUNTLET REVIEW
  -> AUTHORIZATION / HUMAN GATE
  -> ACTION QUEUE
  -> EXECUTION
  -> OBSERVATION
  -> TRUTH ORACLE
  -> VERIFIED/UNVERIFIED/etc.
  -> LEARNING

No direct agent -> external side effect path is valid.

## Bridge envelope

Every bridge invocation must carry:

bridge_id
correlation_id
tenant/store/silo
actor_type
actor_id
role
capability
request_type
input_hash
policy_version
gauntlet_policy_version
evidence_refs
approval_state
idempotency_key
requested_external_effect
created_at

## Roles

CUBE:
- receives signals/events
- normalizes context
- attaches object references
- refuses malformed/unqualified work
- routes work

ELOHIM:
- proposes decisions/actions
- records reasoning inputs and expected effect
- never authorizes its own proposal
- cannot bypass Gauntlet

GAUNTLET:
- adversarial review
- policy evaluation
- contradiction checks
- capability/authority checks
- duplicate/idempotency checks
- required human gate determination
- emits PASS / FAIL / HOLD with evidence

TRUTH ORACLE:
- verifies observed external state
- reconciles provider/system evidence
- assigns truth verdict
- cannot manufacture settlement, fulfillment or outcome evidence

ACTUATOR:
- executes only an authorized action
- records external reference
- emits observation
- cannot upgrade truth status

## Commerce integration

Checkout creation:
CUBE -> Elohim offer/context -> Gauntlet price/product/policy check -> authorized checkout action -> Stripe -> webhook -> observation -> Truth Oracle.

Order fulfillment:
CUBE -> Elohim fulfillment proposal -> Gauntlet authorization -> fulfillment action -> external fulfillment -> observation -> evidence -> Truth Oracle.

Refund:
CUBE -> Elohim refund proposal -> Gauntlet checks authority/order/payment -> human gate if policy requires -> Stripe refund -> webhook -> observation -> Truth Oracle.

No client request may directly mark:
PAID, SETTLED, FULFILLED, VERIFIED, or VERIFIED_EXTERNAL_REVENUE.

## Failure handling

A bridge run must be durable.

States:
RECEIVED, QUALIFIED, PROPOSED, GATE_PENDING, AUTHORIZED, EXECUTING, OBSERVING, VERIFYING, VERIFIED, REJECTED, FAILED, EXPIRED.

Each transition is idempotent and records:
from_state, to_state, actor, policy, timestamp, reason, evidence_refs.

## Cloud implementation mapping

Existing DreamLedger primitives should be reused rather than duplicated:
- CUBE controller/adapter tables and Edge Functions
- agent coordination and role/autonomy records
- approval queue
- commerce supervisor/action records
- Gauntlet policy/certificate structures
- control events/evidence/reconciliations
- Truth Oracle execution/evidence
- economic attribution/outcome records

The bridge layer should add correlation and contract enforcement around these primitives, not create a second orchestration universe.

## Completion test

A synthetic commerce action must be traceable:

signal_id
-> cube decision
-> elohim proposal
-> gauntlet certificate
-> approval/action id
-> external request id
-> external observation
-> truth verdict
-> economic outcome decision.

A missing link is a bridge failure.

## Hard invariant

Agent intelligence may propose.

Policy may authorize.

Humans may approve where required.

Actuators may execute.

Only observed external evidence may establish external truth.
