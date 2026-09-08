# Economic Engine Integration Plan

Status: DESIGN LOCKED, IMPLEMENTATION AFTER RA_000001

## Principle

Revenue validates. Architecture does not.

The economic engine must not become a second authority system. Supabase/BECK remains authoritative for state, admission, entitlements, issuance, ledger records, and evidence references.

## Existing substrate

The live schema already contains economic_demand_signals, economic_events, economic_outcomes, event_ledger, kelplantis_events, marketplace_listings, marketplace_orders, revenue_catalog, and revenue_entitlements.

Do not create parallel sovereign copies of these concepts.

## Economic state machine

DEMAND -> PROPOSAL -> TRUTH ORACLE -> GAUNTLET -> ECONOMIC ADMISSION -> BOUNDED ISSUANCE -> PRIMARY SALE -> ENTITLEMENT -> OPTIONAL SECONDARY TRANSFER -> OUTCOME -> EVIDENCE -> LEARNING

Prediction never grants authority.

## Governed scarcity

Each SKU policy should eventually define:

- max_supply
- initial_issuance
- release_batch
- min_demand_threshold
- price_floor
- release_interval
- decay_rate
- reserve_ratio
- secondary_market_allowed
- transfer_rules
- refund_rules
- royalty_rules
- jurisdiction constraints
- prohibited use

Only an admitted issuance operation can increase issued supply. Secondary transfer does not increase primary supply.

The policy fields are controls only when enforced transactionally by the authoritative database layer. A Python reference implementation is not sufficient authority.

## Event graph

Every meaningful world or economic event should be normalizable into a stable event envelope:

- event_id
- event_type
- actor_id
- target_id
- sku_id / offer_id when applicable
- silo_id
- occurred_at
- location_id when applicable
- parent_event_id when applicable
- correlation_id
- payload_hash
- evidence_ref

Events may then participate in graph edges:

PRECEDED_BY
FOLLOWED_BY
CORRELATED_WITH
SAME_ACTOR
SAME_LOCATION
SAME_SKU
SAME_OPPORTUNITY
SAME_CLUSTER
RESULTED_IN

CAUSED_BY must be reserved for independently supported causal evidence. Correlation must never silently become causation.

## Pattern layer

Raw events -> normalized sequences -> temporal clusters -> recurring patterns -> predictions.

A pattern is a repeated configuration of events, actors, context, and temporal relationships. Examples:

BOSS_FAILURE -> RETURN_TOWN -> HEALING_DEMAND

PRODUCT_PURCHASE -> LOW_USAGE -> SECONDARY_LISTING -> TRANSFER

COMMUNITY_REQUEST -> VOTE -> FEATURE_RELEASE -> USAGE_INCREASE

Patterns are evidence for proposals, not permission to act.

## Prediction lifecycle

PREDICTED -> OBSERVED -> CONFIRMED | PARTIAL | WRONG | EXPIRED

Every prediction should retain:

- prediction_id
- pattern_id
- predicted_outcome
- confidence
- prediction_window
- evidence_ids
- observed_outcome
- calibration_error
- model/version metadata

Prediction quality must be scored retrospectively against observed outcomes.

## Truth Oracle boundary

The Oracle verifies claims against evidence. It may verify that an observed pattern exists, that a historical prediction was calibrated, or that an issuance precondition is satisfied.

It must not accept model confidence as evidence of reality.

## Gauntlet boundary

The Gauntlet attacks:

- supply arithmetic
- max-supply enforcement
- reserve accounting
- price floors
- transfer permissions
- transfer limits
- duplicate settlement
- stale listings
- entitlement lineage
- replay/idempotency
- refund edge cases
- jurisdiction constraints
- royalty/fee calculations
- race conditions
- evidence/reporting failure after successful execution
- external payment UNKNOWN state

A Gauntlet PASS does not itself create economic authority.

## Secondary market

The traded object is a transferable entitlement or explicit right, not underlying IP ownership unless the SKU contract says so.

Transfer lifecycle:

LIST -> MATCH -> AUTHORIZE -> SETTLE -> REVOKE/RETIRE OLD ENTITLEMENT -> ISSUE NEW ENTITLEMENT -> ROYALTY/FEE LEDGER -> EVIDENCE

Settlement and entitlement transfer must be atomic or recoverable through a durable state machine. In-memory mutation is not sufficient.

## AgentBridge integration

External agents should receive scoped tasks and handoffs rather than direct database authority. This follows the verified AgentBridge pattern: an external agent API can expose assigned work, progress, blockers, result notes, and handoffs without granting agents unrestricted database access.

Reference implementations:
- Vann-Dev/AgentBridge: scoped external agent API and task coordination.
- Naab2k3/agent-bridge: MCP coordination, three-tier memory, heartbeat/unread signalling, locking.
- FeiZhuLulu/Agent-Bridge: coordinator/worker process separation.

These are patterns to adapt, not authorities for BECK policy.

## Oracle integration

Multi-model agreement can be useful as corroboration, but consensus is not truth. Deterministic database checks and externally observable evidence remain stronger for concrete economic claims.

Aragora's current architecture is particularly relevant as a reference for adversarial review and portable decision receipts. Its documented boundary explicitly separates governance/review from execution runtime.

## Execution attestation

Execution receipts should bind:

- admission_id
- candidate_sha
- capability_scope
- runner_id
- attempt_number
- start/finish timestamps
- artifact manifest hash
- evidence hash
- result

Signed attestations may strengthen provenance, but a signature proves possession of a signing key, not that the underlying economic claim is true. The Oracle still reconciles execution evidence.

## Execution resilience

Fallback runners are pre-authorized execution strategies, not authority escalation.

Failure classes:

TRANSIENT -> bounded retry
CAPACITY -> permitted alternate runner
DEPENDENCY -> permitted fallback
AUTHORITY -> STOP
INTEGRITY -> QUARANTINE
POLICY -> STOP
UNKNOWN -> reconcile external state / quarantine

Never blindly retry an operation when an external side effect may already have occurred.

## Implementation order

1. Obtain RA_000001, the first genuine stranger payment.
2. Prove fulfilment and record the economic outcome.
3. Harden the existing economic primitives against transactional, replay, and policy-bypass failures.
4. Extend the existing event substrate with a canonical event envelope and graph edges.
5. Build pattern detection over observed history.
6. Build calibrated prediction records.
7. Feed predictions to Elohim as proposals only.
8. Route issuance and marketplace mutations through Oracle -> Gauntlet -> economic admission.
9. Add execution resilience around the proven economic loop.

## Non-goals before RA_000001

- No speculative marketplace build.
- No autonomous supply expansion.
- No multi-agent infrastructure rewrite.
- No claim that cryptographic attestation establishes economic truth.
- No claim that model consensus establishes truth.

## External reference validation

The referenced AgentBridge projects and Aragora were independently checked against their public repositories. Naab2k3/agent-bridge documents its MCP coordination and memory architecture; Vann-Dev/AgentBridge documents scoped external agent APIs; FeiZhuLulu/Agent-Bridge documents coordinator/worker separation; Aragora documents its Gauntlet, decision receipts, and governance/execution boundary.

BootProof's public Receipt Gate documents observed-health execution receipts and Ed25519-signed attestations. These are useful provenance patterns, not substitutes for BECK's Oracle or admission controls.
