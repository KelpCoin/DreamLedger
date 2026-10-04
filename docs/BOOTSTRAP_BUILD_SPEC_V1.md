# DreamLedger Economic Reality Bootstraps v1

Status: implementation specification
Branch: feat/economic-reality-bootstrap-spec
Economic truth at specification time: NZ$0 verified external revenue

## Purpose

Build only the smallest local tools that convert BrownEye activity into observable economic progress. These tools are local, read-only by default, ASCII-only, PowerShell 5.1 compatible, idempotent, and proof-producing.

They do not create a second orchestrator, second queue, second truth system, or second promotion path.

The bootstraps consume existing reality from the repository, local filesystem, public surfaces, and approved cloud evidence. They do not treat infrastructure health as revenue.

## Build order

1. RealitySnapshot
2. CommercialCellPreflight
3. ProofPacketBuilder
4. LoopHandoffGenerator
5. OneCellRunner

Reason: first establish a truthful baseline, then prove a cell is coherent, then package evidence, then hand the next loop to another agent, then automate the repeated manual sequence. This follows the rule: one case write it, two cases copy it, three cases consider abstraction.

## Common contract

Every bootstrap must emit:
- schema version
- generated_at
- source commit if available
- economic state
- facts with truth labels
- blockers
- next_action
- stop_condition
- proof path

Truth labels:
VERIFIED, UNVERIFIED, CONTRADICTED, STALE, TEST, SIMULATED, INTERNAL, UNMATCHED.

No bootstrap may emit VERIFIED for revenue unless a real external settled payment and the required downstream fulfillment/evidence chain are present.

All scripts must:
- run on Windows PowerShell 5.1;
- contain ASCII characters only;
- default to read-only behavior;
- never print secrets;
- never write credentials;
- be safe to rerun;
- fail closed when a required source is ambiguous;
- write deterministic JSON proof under D:\BrownEyeCortex\Proof\bootstraps unless overridden;
- return non-zero only for an actual failed required check, not for an optional source being absent.

## 1. RealitySnapshot.ps1

Purpose: create one compact machine-readable statement of current BrownEye/DreamLedger reality so every agent starts from the same state.

Inputs:
- optional repo root
- optional proof root
- optional current task or cell id

Observations:
- git branch and SHA
- working tree dirty state
- recent local proof files
- known local service ports when reachable
- public DreamLedger root, catalog, offers and target commercial route when supplied
- presence of required environment variable names, never their values
- existing economic proof artifacts

Output:
reality_snapshot.v1

Required fields:
- current_commit
- economic_state
- infrastructure_state
- stale_or_conflicting_facts
- unresolved_questions
- cheapest_next_test
- proof_path

Acceptance:
Two consecutive runs with no underlying state change must differ only in timestamp/path.
The output must explicitly separate infrastructure health from economic proof.

## 2. CommercialCellPreflight.ps1

Purpose: prevent a commercial cell from being declared ready because its parts merely exist independently.

Input:
- cell manifest path

Required manifest fields:
- cell_id
- sku
- offer_id
- price_expectation
- checkout_reference
- attribution_contract
- fulfillment_contract
- evidence_contract
- customer_outcome_contract
- stop_condition

Checks:
1. offer identity exists
2. checkout identity exists
3. checkout identity agrees with the declared SKU/offer/price evidence
4. attribution fields are defined
5. fulfillment entrypoint is defined
6. evidence artifact schema is defined
7. customer outcome is observable
8. no stale competing identifier is marked canonical
9. no test/simulated path is being used as production proof

Output states:
BLOCKED, PREPARED, or READY_FOR_REAL_TRANSACTION.

READY_FOR_REAL_TRANSACTION means only that the cell is technically coherent. It does not mean revenue exists.

Acceptance:
A deliberately mismatched SKU, price, checkout, or fulfillment contract must produce BLOCKED.

## 3. ProofPacketBuilder.ps1

Purpose: turn raw observations from a real transaction or verification run into a bounded evidence packet without manually rediscovering the chain.

Inputs:
- transaction/event identifier
- cell id
- source proof files
- optional operator notes

Output:
proof_packet.v1 containing:
- transaction identity
- buyer evidence classification
- settled payment evidence
- attribution evidence
- fulfillment evidence
- artifact evidence
- customer outcome evidence
- reconciliation evidence
- hashes of included files
- missing evidence
- final truth state

The builder must never manufacture missing evidence. Missing evidence remains missing.

Acceptance:
A packet containing only Stripe object existence must classify as UNVERIFIED, not revenue.
A packet with a real settled payment but incomplete fulfillment must classify as PAYMENT_SETTLED.
Only the complete contract may classify as VERIFIED external revenue.

## 4. LoopHandoffGenerator.ps1

Purpose: convert one completed investigation into the smallest next executable loop for another model or local worker.

Input:
- RealitySnapshot
- CommercialCellPreflight result if relevant
- ProofPacketBuilder result if relevant
- current task

Output:
loop_handoff.v1 with:
- current reality
- known facts
- changed facts
- open uncertainties
- single highest-consequence gap
- smallest action
- expected observation
- falsifier
- stop condition
- approval boundary
- evidence expected

The handoff must not contain generic research work when a concrete verification or repair is available.

Acceptance:
The generated handoff must be executable by a fresh agent without rediscovering the entire system, while still requiring connected-system verification for claims that are not included in evidence.

## 5. OneCellRunner.ps1

Purpose: execute one bounded local verification/production-preparation loop using the four lower-level bootstraps. It is not a general autonomous agent.

Inputs:
- cell manifest
- loop handoff
- explicit mode: VERIFY_ONLY or PREPARE_ONLY

Default:
VERIFY_ONLY.

Permitted actions:
- read repository state
- run local deterministic verifiers
- inspect local proof files
- generate handoffs
- generate proof packets from supplied evidence

Not permitted without a separately approved execution path:
- public outreach
- charging or refunding money
- changing production Stripe objects
- changing production database state
- deploying production
- writing secrets

Output:
one_cell_run.v1

Required termination:
The runner stops after one bounded loop. It cannot recursively invoke itself.
It cannot create a new bootstrap.
It cannot declare success without an observable acceptance condition.

Acceptance:
A run with no economic change must end with NO_ECONOMIC_CHANGE and a concrete next action. It must not generate an endless queue of self-assigned work.

## Meta red-team controls encoded by these bootstraps

Activity inflation:
Every run carries economic_state and next economic transition. CI, commits, deployments, jobs and dashboards cannot advance economic_state by themselves.

BrownEye becoming the product:
OneCellRunner is explicitly a bounded verifier/preparer, not a new product or autonomous business.

Verification cost exceeding transaction value:
ProofPacketBuilder reports evidence completeness and operator steps. If the verification procedure is more expensive than the defined cell economics, the cell can be marked BLOCKED for economic reasons.

First-transaction mythology:
CommercialCellPreflight has a READY_FOR_REAL_TRANSACTION state and does not permit more hardening to be treated as progress once that state is reached.

Stripe/application divergence:
CommercialCellPreflight requires identity agreement across offer, checkout, attribution and fulfillment contracts. Conflicts block readiness.

Catalog drift:
Competing identifiers are surfaced as conflicts. No stale repository value becomes canonical merely because it is present in code.

Premature abstraction:
OneCellRunner is intentionally one-cell and one-loop. Repeatability is evidence required before abstraction.

Acquisition avoidance:
The economic state machine includes NO_BUYER_SIGNAL. If the technical cell is READY but there is no buyer signal, the stop condition is acquisition work, not more engineering.

Operator attention optimization:
LoopHandoffGenerator must state the cheapest next test. ProofPacketBuilder records missing evidence and manual steps so repeated cost becomes visible.

Model hallucination:
All externally verifiable claims are truth-labelled. Gemini is reasoning-only unless evidence is supplied. Connected-system inspection remains the authority for live state.

No stopping condition:
Every bootstrap requires a stop_condition. OneCellRunner terminates after one bounded loop.

## Economic state machine

NO_BUYER_SIGNAL
-> BUYER_SIGNAL
-> CHECKOUT_READY
-> PAYMENT_SETTLED
-> FULFILLMENT_COMPLETE
-> CUSTOMER_OUTCOME_PROVEN
-> VERIFIED_EXTERNAL_REVENUE
-> REPEATABILITY_PROVEN

Transitions require evidence. No state may be skipped.

The system must be willing to move backwards when new evidence contradicts an earlier state.

## Definition of done for this bootstrap pack

The pack is complete when:
- all five scripts exist;
- each has a deterministic local verifier;
- all outputs conform to the common contract;
- a clean run creates proof without mutation;
- a deliberately broken commercial cell is blocked;
- a synthetic/test payment cannot become VERIFIED;
- a real transaction packet can become VERIFIED only after the full chain is evidenced;
- the loop stops when no economic transition is available;
- two independent real transactions exist before any further abstraction is added.

Until then, the next artifact is a transaction, not another specification.