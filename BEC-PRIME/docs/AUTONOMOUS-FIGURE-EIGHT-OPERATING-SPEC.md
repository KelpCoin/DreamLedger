# Autonomous Figure-Eight Operating Specification

Status: BUILD DIRECTIVE
Version: 1.0
Date: 2026-09-19
Scope: BrownEye Cortex / DreamLedger / BEC-PRIME
Primary objective: remove Biggie from routine operation while preserving human control over externally consequential actions.

## 1. Target state

The Figure Eight is not a single autonomous agent. It is a population of bounded workers operating in coupled economic and evolution loops.

The target runtime is:

observe -> propose -> challenge -> verify -> stage -> cool -> execute -> verify outcome -> persist evidence -> score -> feed back -> propose again

Biggie is not the scheduler, debugger, queue manager, catalog reconciler, deployment operator, or routine verifier.

Biggie remains the emergency brake and the authority for actions that create material external consequences.

The system is successful only when it can continue making useful progress while Biggie does nothing.

A running process is not proof of autonomy. A passing test is not proof of revenue. A generated model response is not evidence of an economic outcome.

## 2. Two coupled Figure-Eight loops

### Economic loop

Demand
-> opportunity
-> offer
-> checkout
-> settlement
-> attribution
-> fulfillment
-> proof
-> reconciliation
-> outcome
-> demand signal

### Evolution loop

Observation
-> Elohim proposal
-> Builder mutation
-> Gauntlet attack
-> Truth Oracle verification
-> automated tests
-> staged candidate
-> 24-hour cooling period
-> controlled deployment
-> post-deployment verification
-> KPI/fitness measurement
-> surviving mutation or rollback
-> next proposal

The loops must interact, but neither may silently bypass the other.

Economic outcomes are the strongest feedback signals. Model confidence is not a substitute for economic evidence.

## 3. Population architecture

The supervisor coordinates a family of specialized workers. It must not become an omnipotent agent.

Core roles:

1. Cortex Supervisor
   - schedules work
   - manages policy
   - dispatches workers
   - manages leases
   - watches health
   - coordinates staging and cooldown
   - enforces kill state

2. Elohim
   - proposes opportunities
   - proposes bounded improvements
   - proposes mutations
   - creates candidate work, never autonomous authority

3. Gauntlet
   - adversarially attacks proposals
   - searches for regressions, unsafe assumptions, unsupported claims and economic failure modes
   - emits a durable judgment

4. Truth Oracle
   - distinguishes observation, model output, external evidence and verified fact
   - rejects unsupported claims
   - never upgrades simulated or internal events into economic truth

5. Digital Proxy
   - performs controlled external interaction only where explicitly permitted
   - receives typed jobs rather than unrestricted model instructions
   - records request/result evidence

6. Builder
   - implements bounded changes
   - works in isolated branches/worktrees
   - produces deterministic artifacts where possible

7. Verifier
   - runs unit, integration, contract and regression tests
   - validates artifact integrity
   - proves the result rather than trusting the Builder

8. Economic Worker
   - observes checkout, Stripe, attribution, fulfillment and reconciliation state
   - maintains the BusinessTruth chain
   - treats unmatched payments as UNMATCHED, not revenue

9. Fulfillment Worker
   - executes already-authorized fulfillment
   - is idempotent
   - never represents delivery as complete without durable evidence

10. Sentinel
   - monitors worker health, drift, anomalies, stale leases and policy violations
   - can quarantine workers
   - can trigger safe rollback

11. Evidence Worker
   - records durable evidence
   - hashes important artifacts
   - links observations, decisions and outcomes
   - preserves provenance

12. KPI/Fitness Worker
   - calculates operational, economic and evolutionary fitness
   - prevents single-metric optimization
   - feeds measured outcomes back into the population

These can be implemented as processes, job types or modules. The twelve roles are conceptual boundaries; do not create twelve unnecessary daemons.

## 4. Pinball memory

Supabase is not merely a queue. It is the durable shared memory in which workers leave structured notes, observations, judgments, hypotheses and outcomes.

The pinball effect is intentional:

Worker A observes something.
-> records an evidence-bearing note.
-> Worker B later sees that note.
-> B changes its proposal or test because of the new evidence.
-> Worker C records an independent observation.
-> the Gauntlet incorporates the accumulated signal.
-> the KPI worker measures the outcome.
-> the next Elohim proposal is nudged by the resulting evidence.

Small local changes can compound across many cycles.

This is not uncontrolled agent-to-agent persuasion. Every note must carry provenance, author, silo, timestamp, evidence status and correlation identifiers.

A note can influence a worker's context, but it cannot override policy.

Model-generated notes are MODEL_OUTPUT unless independently verified.

Economic claims remain subject to BusinessTruth.

## 5. Durable note protocol

Use the existing control_bridge_notes table. Do not create a second notes database.

Minimum semantics:

- from_agent
- to_agent
- note_type
- subject
- body
- lane
- priority
- silo_id
- event_id
- correlation_id
- source_system
- execution_status
- expires_at where appropriate

Recommended note types:

OBSERVATION
HYPOTHESIS
GAUNTLET_FINDING
TRUTH_FINDING
IMPLEMENTATION_RESULT
REGRESSION
ECONOMIC_SIGNAL
FULFILLMENT_RESULT
KPI_UPDATE
ROLLBACK
QUARANTINE
HANDOFF

Notes must be append-oriented. Corrections should create new notes linked to the prior event rather than silently rewriting history.

Ephemeral chatter should not become durable memory.

## 6. CUBE isolation

Every worker action is scoped to a silo.

A worker must know:

- silo_id
- job_id
- authority class
- allowed tools
- allowed data
- allowed destinations

Cross-silo information can be summarized through explicit evidence-bearing signals, but private material must not leak between CUBEs.

A strong result in one silo does not automatically authorize execution in another silo.

## 7. Air-gapped / online split

### Local side

LM Studio
PowerShell workers
Cortex
Elohim
Gauntlet
Truth Oracle
Builder
Verifier
local evidence
GPU experiments

### Online side

GitHub
Render
Supabase
Stripe
public DreamLedger
authorized external services

### AgentBridge

AgentBridge is the controlled crossing.

Every bridge job should have:

- job_id
- correlation_id
- sender
- receiver
- silo
- action
- authority class
- payload hash
- idempotency key
- lease
- expiry
- risk class
- required evidence
- result
- proof reference

No free-form model instruction may directly become an external action.

## 8. Authority classes

### GREEN: autonomous

Examples:

- inspect repository
- run tests
- regenerate deterministic artifacts
- repair existing non-financial infrastructure
- restart failed workers
- quarantine broken workers
- analyze logs
- generate evidence
- run local GPU experiments
- clean stale leases according to existing policy
- prepare branches and patches
- rollback to a previously verified safe version

### AMBER: stage first

Changes must pass the full pipeline and remain staged for 24 hours:

candidate
-> Gauntlet
-> Truth Oracle where applicable
-> automated tests
-> evidence
-> 24-hour timer
-> continuous monitoring
-> execute if still eligible

Any contradiction, regression or policy violation resets the timer or kills the candidate.

### RED: human authority required

Never autonomously execute:

- spending money
- changing prices
- creating new commercial offers
- sending outreach
- publishing customer content
- issuing refunds outside pre-authorized deterministic policy
- financial transfers
- legal actions
- changing credentials/secrets
- weakening security controls
- overriding the kill switch
- bypassing a human approval boundary

The machine should prepare the decision package, evidence and proposed action, but stop.

## 9. Kill switch

One authoritative fail-closed kill state.

When killed:

- stop acquisition of new externally consequential work
- stop staged execution
- stop external side effects
- stop financial side effects
- allow safe shutdown and evidence finalization
- preserve leases and state
- record activation
- prevent automatic restart into execution mode

A missing or unreadable kill state must not mean RUN.

Recovery requires explicit release.

## 10. 24-hour staging

The staging system is the mechanism that allows autonomy without requiring Biggie to inspect every change.

A staged object contains:

- candidate_id
- source revision
- artifact hash
- proposer
- Gauntlet receipt
- Truth Oracle receipt if required
- test receipt
- risk class
- created_at
- eligible_at
- expiry
- rollback target
- evidence references

The countdown begins only after all mandatory gates pass.

The supervisor continuously checks the staged object's assumptions.

If the environment changes materially, the candidate returns to validation.

## 11. Economic firewall

BusinessTruth is immutable:

real external buyer
+
settled Stripe payment
+
attribution
+
fulfillment
+
proof

Only this chain produces VERIFIED economic value.

TEST, SIMULATED, INTERNAL and UNMATCHED events never become revenue merely because a model believes they should.

Current economic truth remains NZ$0 verified revenue until a real external transaction closes the complete chain.

The first reference transaction should prove:

checkout
-> Stripe settlement
-> attribution
-> fulfillment
-> evidence
-> reconciliation

Once proven, that primitive becomes the template for additional economic cells.

## 12. Economic cells and multiplication

Do not build one giant monolithic money machine.

Build repeatable economic cells.

Each cell contains:

- demand observation
- opportunity state
- offer
- checkout
- attribution
- fulfillment
- evidence
- reconciliation
- KPI state
- kill boundary

Cells can run concurrently.

They share infrastructure and learning signals but retain silo and authority boundaries.

Replication should occur only from a cell whose behavior is sufficiently verified.

A failed cell is quarantined without requiring the entire population to stop.

A successful cell does not automatically receive permission to expand its external authority.

This is how multiple Figure Eights can coexist safely.

## 13. Collision / cross-pollination

Independent economic cells should produce signals that can be compared.

Useful cross-cell signals include:

- conversion patterns
- fulfillment latency
- customer input requirements
- failure modes
- pricing observations
- channel observations
- demand patterns
- operational cost
- evidence quality
- model performance

Cross-cell signals should be normalized into evidence or hypotheses.

They should not become direct instructions.

The population can therefore "collide" intellectually without collapsing the CUBE boundaries.

## 14. Fitness function

The population should optimize a composite fitness function.

Positive signals:

- verified external revenue
- completed fulfillment
- repeatable conversion
- reduced operator intervention
- reduced latency
- reliable evidence
- successful autonomous repairs
- durable uptime
- useful prediction accuracy
- successful validated mutations

Negative signals:

- fabricated revenue
- unmatched economic events
- unsupported claims
- security violations
- regressions
- failed deployments
- unnecessary operator escalation
- excessive retries
- stale jobs
- evidence gaps
- policy violations

Revenue is important, but revenue without truth is a catastrophic fitness failure.

Operator intervention should become increasingly rare.

## 15. KPI dashboard

Track at minimum:

Economic:
- verified revenue
- external settled transactions
- attribution completeness
- fulfillment completion
- fulfillment latency
- refunds
- conversion
- repeat purchase where available

Autonomy:
- operator interventions
- operator minutes
- autonomous jobs completed
- autonomous repairs
- staged changes
- rejected changes
- automatic rollbacks
- kill activations

Reliability:
- worker availability
- heartbeat failures
- lease failures
- stale jobs
- retries
- bridge failures
- verification failures
- regression rate

Evolution:
- proposals
- Gauntlet rejection rate
- Truth Oracle contradiction rate
- accepted mutations
- reverted mutations
- fitness change
- prediction accuracy
- replicated cells
- quarantined cells

The dashboard must show evidence state, not merely counts.

## 16. GPU scheduler

Use available GPU capacity for parallel work that can change the system's measurable state.

Priority classes:

P0: economic rail verification
P1: autonomy reliability
P1: regression and adversarial testing
P2: repository/code analysis
P2: evidence classification
P2: worker/model comparison
P3: speculative experiments

A GPU experiment should have:

- experiment_id
- hypothesis
- input snapshot
- model/version
- resource budget
- expected measurable outcome
- result
- evidence
- fitness impact

Discard experiments that cannot affect a decision, artifact, reliability measure or economic learning signal.

## 17. Self-building contract

The Builder may modify existing code only within its authority.

Before execution:

- branch isolation
- deterministic diff
- tests
- Gauntlet
- Truth Oracle where relevant
- staging
- 24-hour delay
- continuous monitoring

The Builder may not modify:

- the core authority policy
- the kill-switch semantics
- the economic truth definition
- human approval boundaries
- evidence status semantics

Those are governance primitives.

## 18. Failure behavior

Failure must become information.

Worker failure:
-> retry if safe
-> otherwise quarantine
-> evidence
-> supervisor continues other cells

Bridge failure:
-> preserve job
-> do not duplicate side effect
-> retry using idempotency key
-> escalate only when policy requires

Economic mismatch:
-> mark UNMATCHED
-> do not count revenue
-> investigate automatically
-> preserve evidence

Truth contradiction:
-> reject candidate
-> record contradiction
-> feed signal to Elohim

Regression:
-> rollback
-> quarantine candidate
-> preserve test receipt
-> update fitness

Kill switch:
-> halt external execution
-> preserve evidence
-> wait for explicit release

## 19. Current DreamLedger catalog repair

Before broad autonomy expansion, resolve the existing catalog inconsistency.

Canonical approved records exist in:

BEC-PRIME/catalog/offers/approved.json

The verifier reads:

BEC-PRIME/catalog/offers/offers.json

The compiled artifact currently does not contain the canonical approved IDs:

OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001
OFFER-CMD-DIAG-29-NZD

The compiler already contains explicit approval compilation logic that converts approved records to:

approval_required=false
checkout_available=true
status=VERIFIED_AVAILABLE

The Commander capability also needs to exist in the canonical capability catalog.

Required proof:

approved.json
-> capability catalog
-> OfferCompiler
-> offers.json
-> Verify-ApprovedOfferContract
-> /api/offers

All layers must agree.

Do not solve this by weakening the verifier.

Do not create a duplicate catalog.

Do not invent a new offer or price.

## 20. First autonomy acceptance test

The first acceptance test is deliberately harmless.

Biggie does not operate the worker.

The local runtime must:

1. start the supervisor headlessly;
2. start or connect to LM Studio;
3. claim a noop/inspection job;
4. execute through AgentBridge;
5. leave a durable note;
6. produce evidence;
7. release the lease;
8. record KPI telemetry;
9. survive worker restart;
10. respect the kill switch.

Then repeat with a real repository repair.

Then repeat with a staged code change.

Then close the first genuine economic transaction.

## 21. Definition of Biggie Bottleneck = 0

The system reaches the desired operating state when, during a sustained observation window:

- routine jobs execute without Biggie
- workers recover from routine faults
- staged changes self-validate
- the 24-hour gate operates without manual babysitting
- evidence remains durable
- economic truth remains conservative
- multiple cells can operate concurrently
- one failed cell does not collapse the ecosystem
- GPU capacity is productively scheduled
- the pinball memory produces measurable downstream improvements
- Biggie can activate the kill switch and stop the system
- Biggie is not required to keep the system alive

The strongest acceptance criterion is not "autonomous."

It is:

**Biggie can leave. The system continues. The system remains truthful.**

## 22. Non-goals

Do not:

- manufacture revenue
- simulate customers
- automate fake demand
- create fake testimonials
- spam outreach
- blindly clone economic cells
- allow models unrestricted internet access
- let model notes override policy
- merge code solely because a model approves it
- treat API availability as economic proof
- replace durable evidence with logs
- replace the existing architecture with a new framework merely because it sounds more autonomous

## 23. Build order

1. Local headless supervisor.
2. Worker registry and health.
3. Durable job state and leases.
4. Kill switch.
5. Typed AgentBridge envelopes.
6. Pinball note/evidence flow.
7. Gauntlet integration.
8. Truth Oracle integration.
9. 24-hour staging.
10. Automated rollback.
11. KPI/fitness loop.
12. GPU experiment scheduler.
13. Current offer-catalog repair.
14. End-to-end economic rail.
15. First replicated economic cell.
16. Controlled multi-cell operation.
17. Continuous self-building loop.

Do not skip from "workers run" to "autonomous money."

Every transition requires evidence.

## 24. Standing operating rule

The machine should do the maximum safe amount of work without asking Biggie.

When a task is GREEN, execute it.

When it is AMBER, stage it and let the delay/gates operate.

When it is RED, prepare everything and stop at the human boundary.

When uncertain, fail closed.

When evidence contradicts the model, believe the evidence.

When economics contradicts the architecture, believe the economics.

When a worker fails, quarantine the worker, not the whole ecosystem.

When a cell succeeds, replicate the proven primitive, not the unverified assumptions around it.

The ultimate interface is intentionally tiny:

**RUNNING**
**STAGED**
**EXCEPTION**
**KILLED**

Everything else belongs inside the machine.
