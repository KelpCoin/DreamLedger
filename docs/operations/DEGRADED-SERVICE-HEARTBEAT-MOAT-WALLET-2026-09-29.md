# DreamLedger: Degraded Service, Proof of Life, Moat, and Wallet Architecture

Status: DESIGN / UNVERIFIED IMPLEMENTATION
Date: 2026-09-29

## Purpose

This document consolidates the proposed resilience architecture for DreamLedger and BrownEye Cortex:

- graceful degradation instead of binary failure
- deterministic heartbeat and proof of life
- explicit autonomy demotion
- per-provider circuit breakers
- durable dead-letter staging
- independent transaction verification
- liveness gating
- evidence as the long-term trust asset
- secure wallet provisioning with strict human safety boundaries

This document records design intent. It does not claim that every component below is deployed, tested, or production-ready.

## Core doctrine

Everything breaks. The system therefore treats failure as an expected operating condition.

A dependency outage should reduce capability rather than manufacture success. The system should preserve safe functions, queue recoverable work, switch to an independent fallback when one exists, and stop actions whose safety or truth conditions cannot be established.

The owner's available maintenance time should be used for supervision, decisions, and exceptional recovery, not repeated bootstrapping of routine services.

## Degradation model

The autonomy ladder is:

- A0 HUMAN_TRIGGERED: human explicitly initiates the action.
- A1 SCHEDULED: the machine wakes on schedule and performs bounded, non-transactional work.
- A2 SELF_DIRECTED: the machine selects a bounded next action from known state and policy.
- A3 SELF_TRANSACTING: the machine may transact and fulfill within explicit authorization and verification boundaries.
- A4 SELF_IMPROVING: future priorities may change only from independently verified economic outcomes.

A failure should normally demote capability by one or more levels according to the failed dependency. It must not fabricate continuity.

Important refinement: demotion is capability-specific, not necessarily global. A Base RPC outage can disable chain-settlement operations while allowing research or local processing to continue. A local PC outage can disable local inference while cloud-safe functions continue. A database outage can permit read-only or locally queued operation but must prevent claims that a durable cloud write succeeded.

A0 remains the hard safety floor for actions requiring unavailable authority, missing evidence, or unavailable financial controls.

## Circuit breaker

Use a global/shared breaker per provider or critical dependency, rather than allowing every session to independently rediscover the same outage.

Recommended starting parameters:

- failure threshold: 3 failures
- detection window: 60 seconds
- initial cooldown: 120 seconds
- extended cooldown: 900 seconds after repeated trips
- half-open probes: 1
- exponential backoff with jitter for retries

Trip only on infrastructure or availability failures such as timeout, connection refusal, 502, 503, or 504. Do not trip merely because a request was invalid or a business rule rejected it.

State machine:

CLOSED -> OPEN -> HALF_OPEN -> CLOSED

Repeated instability:

OPEN -> OPEN_EXTENDED -> HALF_OPEN_EXTENDED -> CLOSED

The breaker must be persisted or shared enough that concurrent workers do not each continue hammering an unavailable provider.

## Fallback chain

Preferred order is capability-dependent:

primary provider -> independent provider -> local/deterministic implementation -> durable queue -> explicit block/escalation

Fallback selection must consider capability requirements. A vision request cannot silently fall back to a text-only model. A payment verification request cannot silently fall back to an unverified assertion.

Fallback success must be recorded distinctly from primary success so reliability data remains honest.

## Heartbeat control plane

Heartbeat is a control-plane primitive, not merely a monitoring ping.

Each tick should follow:

1. Scheduler fires.
2. Deterministic probes execute.
3. Policy engine computes state.
4. Escalation gate decides whether model/tool reasoning is required.
5. Action dispatcher emits a safe action, repair task, alert, or no-op.

Deterministic probes are the primary truth. Model reasoning may interpret ambiguity but must not override hard safety or truth rules.

Suggested states:

HEALTHY
DEGRADED
FAILED
UNKNOWN
RECOVERING

Stale or missing telemetry is UNKNOWN, never HEALTHY.

Heartbeat envelope should contain:

- protocol version
- agent/component identifier
- heartbeat identifier
- UTC timestamp
- monotonic sequence number
- probe results
- policy state
- reasons
- selected fallback
- action
- software/config version
- correlation/idempotency key
- previous proof hash
- current proof hash

Replay protection should reject sequence numbers that are not greater than the highest accepted sequence for the same identity.

A lease/fencing token is required before executing a side-effecting heartbeat tick. Scheduler frequency alone is insufficient because overlapping or duplicated executions can produce duplicate effects.

## Local plus cloud proof of life

Use independent observation paths where feasible.

Local Windows Task Scheduler proves:

- host/task availability
- supervisor execution
- process liveness
- local inference availability
- disk/resource state

Cloud observation proves:

- public application availability
- cloud heartbeat freshness
- database evidence freshness
- deployment health
- external dependency reachability

If the PC is offline, cloud status must explicitly say LOCAL_OFFLINE. It must not report the complete system as healthy.

If cloud persistence is unavailable, local status can be queued for replay, but no cloud write may be claimed until acknowledged.

OS/process liveness and application self-report should be treated as separate signals. A process that says it is healthy while its worker thread is dead is not healthy.

## Figure Eight

Figure Eight should remain an authority boundary.

The upper control loop evaluates system state, policy, and evidence. The lower execution loop performs only actions permitted by that policy.

A Figure Eight heartbeat therefore needs to expose:

- last observed control-loop state
- last action-loop execution
- sequence/freshness
- policy decision
- evidence references
- unresolved contradictions
- fallback state
- authority-gate status

The system must not mark Figure Eight healthy merely because the same process that implements it reports itself healthy. Independent observation is required.

## Dead-letter staging

Failed persistence and recoverable operations should be staged rather than silently dropped.

Recommended table:

dead_letter_staging:
- id
- operation
- payload
- error_message
- error_class
- retry_count
- max_retries
- next_retry_at
- created_at
- resolved_at
- resolution
- correlation/idempotency key

Error classes:

- TRANSIENT: retry with exponential backoff and jitter
- VALIDATION: correct/replan, then retry if appropriate
- AUTH: configuration recovery, no blind retry
- PERMISSION: route substitution or human decision
- BUYER_REJECTION: record learning, do not hammer the same action
- PERMANENT: stop and escalate

The DLQ must be actively monitored. A non-empty DLQ is an operational signal, not a passive archive.

Every redrive must preserve the original event identity and be idempotent.

## Evidence chain and moat

The proposed moat is the accumulated evidence of real consequential actions, not the underlying model.

Potentially durable assets include:

- independently reproducible transaction verification
- tamper-evident runtime proofs
- database-level truth gates
- documented policy and authority boundaries
- failure/recovery history
- provider-independent interfaces
- repeatable fulfillment procedures
- independently verified external outcomes

A competitor can reproduce an algorithm. They cannot retroactively reproduce another system's historical verified transactions or recovery record.

However, this is only a potential moat today. DreamLedger currently has zero verified external revenue, zero settled external payments recognized as economic truth, zero independent external buyers, and zero verified economic outcomes. Those facts must remain unchanged until the evidence gates pass.

The first verified external settlement would be evidence of a functioning economic rail, not proof by itself of a durable competitive moat.

## Independent transaction verification

For x402, the verifier should not rely solely on a facilitator's receipt.

The reconciliation path should independently inspect the transaction and verify the relevant chain facts, including:

1. transaction mined
2. transaction succeeded
3. correct network
4. correct USDC contract
5. payer
6. payee
7. exact amount
8. matching Transfer event
9. transaction sender
10. transaction target
11. required confirmations

Testnet activity remains test activity and must not promote revenue.

An additional independent read-only verifier may be evaluated, but no third-party MCP/package should be treated as trusted merely because research says it exists. It must be independently inspected, pinned, tested, and isolated before production use.

## Liveness gates

Liveness checks can become an optional transaction policy once their semantics and privacy/security properties are verified.

Do not make an external agent's liveness score a universal prerequisite for every transaction without first establishing:

- authoritative source
- identity binding
- freshness semantics
- failure behavior
- privacy implications
- availability
- exit path
- cost
- false-positive/false-negative behavior

The internal heartbeat remains authoritative for DreamLedger's own service health. External liveness systems are additional signals, not substitutes for transaction verification.

## Wallet architecture

A wallet is a high-risk capability and must be treated differently from ordinary automation.

The machine may be able to provision a wallet programmatically, but autonomous key generation does not by itself establish safe custody. A TEE, managed wallet, MPC system, or local encrypted signer each has different trust assumptions and recovery characteristics.

Before selecting a provider, verify:

- custody model
- export/recovery semantics
- signer authorization model
- transaction limits
- contract/address allowlists
- session/key lifetime
- emergency revocation
- audit logs
- provider outage behavior
- chain support
- fees
- legal/account requirements
- disaster recovery
- whether the provider can freeze or otherwise control access

Never place a private key, seed phrase, recovery secret, or signing credential in chat, GitHub, logs, proof JSON, or ordinary environment dumps.

Autonomous wallet provisioning must not silently create financial exposure. The safe capability boundary is:

wallet creation -> address discovery -> receive-only configuration -> verification -> explicitly authorized spending

Receiving payments does not require the system to have permission to spend them.

For initial x402 testing, the system should prefer a receive-only testnet address and prove the entire observation/reconciliation path before any mainnet activation.

## Spending guardrails

If a programmable signer is eventually authorized for outbound transactions, enforce independent controls:

- maximum transaction value
- maximum daily value
- allowed chains
- allowed token contracts
- allowed recipient addresses where feasible
- rate limits
- nonce/idempotency protection
- emergency disable
- audit trail
- human approval for changes to financial policy

A local fallback signer should not automatically become active merely because a hosted signer fails. That would turn an availability fallback into a security bypass.

## Accessibility requirement

Routine operation must be designed around the owner's available maintenance window.

The machine should automatically:

- start required local services at boot
- verify their health
- restart safe failed processes
- record restart reasons
- reconnect to cloud services
- retry transient operations
- stage failed writes
- report degraded state
- produce a concise daily digest

The owner should generally be asked to:

- approve consequential external actions
- resolve ambiguous policy decisions
- supply secrets through the appropriate secure UI when unavoidable
- make financial/authority decisions
- handle failures that automation is explicitly prohibited from handling

The goal is not zero human involvement. The goal is high verified outcome per unit of human attention.

## Failure injection plan

Use isolated test fixtures, never live customer or financial records.

Test:

1. local inference process stopped
2. local supervisor paused
3. network timeout
4. HTTP 429
5. HTTP 500/502/503/504
6. stale heartbeat
7. duplicate heartbeat
8. duplicate event
9. Supabase write failure
10. cloud unavailable
11. payment verifier unavailable
12. Figure Eight unavailable
13. wallet provider unavailable
14. provider recovery/flapping
15. Windows reboot
16. interrupted deployment
17. DLQ redrive
18. clean restore from exported evidence/configuration

Acceptance requires reproducible evidence showing correct state transitions and no unauthorized side effects.

## Scoreboard

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

Reliability architecture status must be reported separately from economic truth.

## Implementation order

P0: Read-only inventory of the current local/cloud heartbeat, Figure Eight, runtime_proofs, scheduled tasks, deployment health, x402 verifier, and existing leases.

P1: Canonical heartbeat schema and component registry.

P2: Local/cloud independent observers and freshness states.

P3: Capability-specific degradation ladder and circuit breakers.

P4: Dead-letter staging and idempotent redrive.

P5: Fault-injection and recovery proofs.

P6: Independent x402 verification adapter.

P7: Wallet architecture evaluation and receive-only testnet provisioning, subject to explicit financial/security approval boundaries.

P8: Mainnet activation only after testnet observation, reconciliation, evidence persistence, and all safety gates pass.

## Final principle

The system should be difficult to kill, easy to understand when degraded, hard to trick into claiming success, and inexpensive in owner attention.

It should never confuse resilience with autonomy, autonomy with revenue, or architecture with proof.
