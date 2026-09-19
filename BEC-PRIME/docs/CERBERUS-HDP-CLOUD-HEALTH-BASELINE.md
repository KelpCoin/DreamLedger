# Cerberus / HDP / Cloud Figure-Eight Health Baseline

Status: AUDIT BASELINE
Date: 2026-09-19
Scope: BrownEye Cortex / DreamLedger / BEC-PRIME

## HDP boundary

HDP is treated as provenance evidence, not authorization. The current IETF document is an individual Internet-Draft, not an IETF standard. Its design uses signed delegation provenance and offline verification. It does not replace AgentBridge access control, leases, fencing, idempotency, or the RED approval boundary.

## Cerberus role

Cerberus remains the adversarial subsystem. It attacks proposed assets and workflows; Gauntlet evaluates the resulting findings; Elohim proposes bounded repairs; Truth Oracle determines whether claims are supported by evidence. Cerberus must not be given authority to publish, spend, change prices, create offers, send outreach, or bypass approval boundaries.

## Current cloud observations

Render service DreamLedger1 is configured on main with auto-deploy enabled, one free instance, health path /healthz, and public access. The newest observed deployment for commit dc9aa84c7c158f5db824d14990a3354f804f09fa failed during application startup. The build itself succeeded. The startup failure was a JavaScript syntax error in BEC-PRIME/runtime/EconomicJobWorkerAdapter.js at line 18: `SyntaxError: Invalid regular expression flags`. A concurrent ProductionBridgeWorker startup also reported `claim_job returned a lease without a job id`.

The previous deployment 0500fde39a433c6e9c0142bbef75bf5f34f211f1f is live. Therefore production is not verified at the newest commit and must not be described as converged with that commit.

## CI observations on the autonomous Figure-Eight specification commit

Successful workflow runs included Production Recovery Execute, Checkout Metadata Contract, CUBE Marketplace Gate, BECKPrime MCP Security Gate, Ecosystem Integrity Gate, Acquisition Proof Gate, Public Surface Guard, DreamLedger Ignition Verifier, Security Baseline, BEC-PRIME Gates, DreamLedger production finisher gate, IP Integrity and Commerce CI/CD, DreamLedger build, Forensic BEC Compiler Run, economic-revenue-gate, Browning Economic Gate, DreamLedger Public Surface Gate, Truth Oracle Ledger Gate, DreamLedger Compiler Gate, and wealth-engine-verify.

Observed failures were:

- Stripe Checkout Contract: `Verify Stripe Checkout producers` failed.
- DreamMeez Public Surface Gate: `Verify public route allowlist` failed.
- MTG Diagnostic Fulfillment Gate: `Verify public surfaces exist` failed.
- Cortex CI/CD Live Release Gate: `Verify Stage 1 proof contract` failed.
- DreamLedger Gauntlet Release Gate: `Verify critical syntax` failed.

These are evidence items, not proof that the whole system is unhealthy. They identify specific gates that require repair or reconciliation.

## Required next repairs

1. Reconcile and fix the EconomicJobWorkerAdapter.js syntax defect on an isolated branch. Do not weaken the syntax gate.
2. Reproduce and resolve the `claim_job` lease envelope mismatch without introducing a second queue or weakening lease fencing.
3. Rerun the five failed CI gates after deterministic fixes.
4. Reconcile the approved offer catalog chain: approved.json -> capability catalog -> OfferCompiler -> offers.json -> Verify-ApprovedOfferContract -> /api/offers.
5. Add HDP as optional provenance metadata at AgentBridge ingress and evidence boundaries. Do not make an unimplemented HDP token a blocker for existing local jobs.
6. Require offline HDP verification before any future AMBER candidate crosses into execution, while retaining existing AgentBridge authority and kill-switch enforcement.
7. Feed Cerberus findings into durable evidence-bearing notes; never let adversarial model output become a Truth Oracle fact without independent evidence.
8. Keep economic truth at NZ$0 verified until the full BusinessTruth chain closes.

## 12-role health contract

Supervisor: scheduling, leases, kill state, staging.
Elohim: proposals only.
Gauntlet: adversarial rejection.
Truth Oracle: evidence classification and contradiction.
Digital Proxy: typed external jobs only.
Builder: isolated deterministic changes.
Verifier: tests and contracts.
Economic Worker: settlement, attribution, fulfillment, reconciliation.
Fulfillment Worker: idempotent authorized delivery.
Sentinel: health, drift, stale leases, quarantine.
Evidence Worker: provenance and durable receipts.
KPI/Fitness Worker: measured operational/economic/evolution outcomes.

No role receives authority merely because another role recommends it.

## Red boundaries

No autonomous spending, price changes, new offers, outreach, public customer publication, refunds outside deterministic policy, financial transfers, legal actions, credential changes, security weakening, kill-switch override, or human-approval bypass.

## Acceptance target

RUNNING means workers operate. STAGED means a candidate passed required gates and is cooling. EXCEPTION means evidence requires repair or human decision. KILLED means external execution is fail-closed.

Biggie Bottleneck = 0 is not claimed until routine operation, recovery, durable evidence, staging, kill behavior, and multi-cell isolation are independently demonstrated.
