# Gemini 25-Domino Execution Chain
## BrownEye Cortex / DreamLedger Control Doctrine
Status: EXECUTION-READY / runtime gate still UNVERIFIED

Purpose
This is the execution chain for Gemini. Execute in order. Do not skip a failed domino, invent evidence, or expand architecture while a lower domino is unresolved.

Core BusinessTruth
Real external buyer + settled Stripe payment + attribution + fulfillment + proof = BusinessTruth.
A test payment, simulated result, internal event, generated code, HTTP 200, or architecture document is not external economic proof.

Truth labels
VERIFIED / UNVERIFIED / CONTRADICTED / STALE / TEST / SIMULATED / INTERNAL / UNMATCHED

Operating doctrine
- Evidence before claims.
- Runtime before architecture.
- Economic evidence velocity over infrastructure volume.
- Manual deliverable -> prove once -> bridge repeatability -> package offer -> sell.
- No capability proof = no revenue claim.
- No outreach before a sellable deliverable and functioning multi-model bridge.
- Human approval remains required for public release, outreach, live financial action, and secrets.
- Never fabricate a scoreboard.
- Keep MTG/HappyHomarid and other silos isolated.
- One reusable runtime can serve many silos; do not create 100,000 websites to represent 100,000 opportunities.
- Prefer local-first execution and LM Studio workers where practical.
- Staged loops: observe -> shadow -> enforce.
- Separate economic, failure, and policy loops. Share mechanisms, not uncontrolled authority.
- Truth Oracle attests deterministic contract compliance. It does not become an autonomous judge of semantic truth.
- Gauntlet judges proposals. Elohim creates/refines/heals proposals.
- Every loop proposal must state: mechanism claim, evidence basis/strength, pre-written kill condition, cost ceiling, predicted first finding, and falsification observation.
- Kill switch must be outside agent authority. A real ACL test must prove the service account cannot delete or rewrite it.
- Public distribution is a rail, not proof of demand. Discord/webhooks do not equal conversion.
- Arbitrage means verified net economic advantage, not merely an observed price differential.

Current known state
- Loop Factory: not running.
- Runtime claim gate: UNVERIFIED until the local Node test is actually run.
- External revenue: NZ$0.
- Live Billboard checkout: operational, but no settled external revenue has been established.
- Arbitrage engine: UNVERIFIED.
- Supervisor: UNVERIFIED.
- LM Studio inference path: UNVERIFIED.
- Agent rail: design claims only until executable tests pass.
- Do not claim the eight validator tests pass until raw output proves it.

## Domino 01: Runtime claim exam
Run on the Windows machine:
cd D:\BrownEyeCortex\DreamLedger-Cockpit-Test\BEC-PRIME\runtime
node --test test-claim-validator.js 2>&1 | Tee-Object -FilePath D:\BrownEyeCortex\claim-validator-run.txt
Get-Content D:\BrownEyeCortex\claim-validator-run.txt
Required result: raw test output and exit status. If any test fails, STOP and repair only this gate.
Hard stop: no green claim-validator result, no worker claiming.

## Domino 02: Preserve immutable run evidence
Copy raw output to the evidence lake. Record timestamp, command, host, Node version, working directory, exit code, and SHA-256 of the evidence file.
Required result: reproducible run record. Do not overwrite a prior run without versioning.

## Domino 03: Establish source-of-truth runtime artifacts
Confirm actual contents and paths of:
- test-claim-validator.js
- claim-validator.js
- EconomicJobWorkerAdapter.js
Required result: paths, hashes, and relevant source excerpts. Architecture documents do not substitute for source.

## Domino 04: Inspect the adapter contract
Determine exactly how EconomicJobWorkerAdapter.js receives a job, validates it, claims it, leases it, executes it, and reports completion/failure.
Required result: concrete call path, not a diagram.

## Domino 05: Wire claim validation into the worker
The worker must reject invalid claims before side effects.
Required result: code change plus test. Validation failure must not create an economic side effect.

## Domino 06: Prove adapter behavior
Test accepted and rejected jobs through the real adapter boundary.
Required result: passing tests for valid claim, invalid claim, malformed payload, and unauthorized claim context.

## Domino 07: Prove lease semantics
Claiming must be exclusive and time-bounded.
Test lease acquisition, duplicate claim, lease expiry, and legitimate reclaim.
Required result: raw test evidence.

## Domino 08: Prove stale-result rejection
A worker holding an old lease must not complete or mutate a job after ownership has moved on.
Required result: stale completion rejected deterministically.

## Domino 09: Prove idempotency
Retries must not duplicate economic actions or evidence.
Test the same job/event twice.
Required result: one effective outcome with deterministic duplicate handling.

## Domino 10: Prove sender/receiver identity
The bridge must establish who sent the job and who accepted it.
Required result: authenticated sender/receiver evidence, correlation ID, request hash, and rejection of unauthorized traffic.

## Domino 11: Prove the bridge transport
Exercise the actual AgentBridge transport, not a mock.
Required result: authenticated HTTP path, no DB fallback masquerading as transport, sender/receiver proof, lease fencing, stale rejection, and idempotency.

## Domino 12: Prove supervisor behavior
Run the headless supervisor against a controlled job.
Required result: it discovers, dispatches, observes, records, and recovers according to policy without human prompting.

## Domino 13: Prove the kill switch is outside agent authority
Verify Windows ACL behavior using the actual service identity.
Required result: human/operator can write the kill switch; service account can read it but cannot delete or rewrite it.
If the service account can modify it, the kill switch is NOT real.

## Domino 14: Prove LM Studio execution
Use the real local LM Studio path.
Required result: bounded worker can request inference, receive a response, time out safely, record failure, and continue without inventing success.
A cloud model is not a substitute when local execution is the stated requirement.

## Domino 15: Prove the six-part loop proposal gate
Every proposed loop must contain:
1. specific mechanism claim
2. evidence basis and evidence strength
3. pre-written kill condition
4. cost ceiling
5. predicted first finding
6. falsification observation
Required result: machine-checkable proposal object plus rejection tests.

## Domino 16: Implement staged loop lifecycle
Use OBSERVE -> SHADOW -> ENFORCE.
Observe logs only. Shadow evaluates policy without enforcement. Enforce applies approved controls.
Required result: state-transition tests and explicit prohibition on silent promotion.

## Domino 17: Activate the economic loop in a sandbox
Pipeline:
scanner -> finding -> verification -> alert -> human action -> settlement -> evidence
Required result: one end-to-end non-financial dry run that proves control flow without pretending it is revenue.

## Domino 18: Verify payable price, not observed price
For arbitrage, distinguish observed price, payable price, fees, tax, FX conversion, availability, inventory/seat/card condition, eligibility, and time sensitivity.
Required result: verifier that rejects attractive-looking but non-purchasable differentials.

## Domino 19: Calculate verified net saving
net saving = independently verified alternative cost avoided - verified acquisition cost - unavoidable fees - conversion costs - fulfilment/risk costs
Only verified positive-net findings advance. Gross spread is not an arbitrage win.

## Domino 20: Add realization measurement
Track observed differential, verified differential, and realized saving.
Execution Realization Coefficient = realized saving / observed differential.
Use this to tune thresholds only after evidence accumulates.
Required result: prediction and outcome fields, not retrospective storytelling.

## Domino 21: Distribution rail
Build the alert output as a productized artifact.
Discord/webhook is distribution infrastructure, not economic proof.
Required result: structured alert containing evidence, timestamp, source, verification status, expiry, net economics, and action URL.
Public posting remains approval-gated.

## Domino 22: Attribution and conversion proof
A click is not a sale. A checkout session is not settled revenue.
Required result: deterministic attribution from alert/session to settled payment and fulfillment. Self/test/simulated events cannot become BusinessTruth.

## Domino 23: Settlement and evidence vault
On real external settlement, write buyer class, payment event, amount/currency, attribution, fulfillment result, source evidence, verification state, content hash, and timestamps.
Required result: one auditable evidence chain.
RA_000001 changes only when actual conditions are satisfied.

## Domino 24: Failure and policy loops
Failure loop: failure -> diagnosis -> mechanism update -> retest.
Policy loop: human decision -> reason -> policy candidate -> repeated evidence -> approved automated rule.
Required result: both loops are bounded, separately scheduled, and prevented from silently changing financial/public policy.

## Domino 25: First real economic experiment
Only after Dominos 01-24 are green where applicable, select one narrow, sellable, externally verifiable experiment.
Candidate wedges may include NZ domestic airfare verified-savings alerts, MTG price differential / Commander diagnostics in the isolated HappyHomarid silo, or a concrete DreamLedger production-verification service.
Use the strongest evidence-backed wedge available at that point, without ranking by intuition alone.
Required result:
external buyer -> settled payment -> attributable source -> fulfilled output -> evidence -> verified economic outcome.
If no buyer converts, record NO CONVERSION. Never manufacture a win.

## Gemini operating instruction
Execute exactly one domino at a time.
For every domino return:
DOMINO
ACTION
RAW EVIDENCE
RESULT
TRUTH STATUS
BLOCKERS
NEXT DOMINO

Never say PASS unless evidence demonstrates the acceptance condition.
Never infer deployment from source code.
Never infer revenue from checkout availability.
Never infer truth from model confidence.
Never use generated architecture to fill a missing runtime artifact.
When a gate fails, stop at that gate and produce the smallest repair required.
Do not create new verticals, silos, websites, agent personas, or architecture layers while a lower gate is red.
Objective: maximize verified economic evidence per unit of execution cost while preserving safety, attribution, auditability, and human control over consequential public/financial actions.
