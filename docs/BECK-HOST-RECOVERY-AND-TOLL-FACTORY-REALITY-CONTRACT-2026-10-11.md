# BECK Host Recovery + Toll-Road Factory Reality Contract
**Date:** 2026-10-11  
**Status:** DESIGN CONTRACT; implementation and production readiness are UNVERIFIED  
**Purpose:** Make the conceptual BrownEye Cortex / DreamLedger factory implementable and make the Windows PC a managed host rather than an invisible single point of failure.

## Executive truth
The supplied four-stage factory is a useful hypothesis, not evidence that a million endpoints can currently be generated, deployed, charged, fulfilled, measured, or healed. The citations in the supplied text are unavailable here and several source links were removed, so its numbered claims are not independently verified.

Current known constraints:
- The DreamLedger first-dollar toll probe is still an evidence-gated experiment. The success chain is independent buyer → settled payment → entitlement → authenticated execution → delivery receipt → reconciliation.
- GitHub issue #609 records an unresolved Supabase PostgreSQL WAL disk-full outage. DB durability, atomic quotas and DB-backed fulfillment must remain UNVERIFIED until re-tested.
- Historical notes describe the local PC as a host for LM Studio/BrownEye workloads and prior blue-screen concerns, but we do not have current Windows minidumps, Event Viewer evidence, device-driver state or a fresh local diagnostic report in this session.
- A remote agent cannot repair a completely crashed host using only software running on that same host. A separate observer can detect host loss; actual recovery requires a reachable management plane, firmware/hardware support, or a human power/reboot action.

## Required architecture: one authority, two recovery planes

### Plane A: Local Host Guardian (Windows PC)
Runs on the actual host under a least-privilege service/task identity and writes a durable local event journal. It must be able to:
1. Observe OS uptime, recent bugcheck/WER events, minidump presence, disk free space, memory pressure, GPU/driver resets, thermal/power indicators where available, service/process health, LM Studio API/model IDs, and scheduled-task outcomes.
2. Capture before/after evidence and hashes; correlate events by boot/session ID and timestamp. Do not claim a root cause from a stop code alone.
3. Apply only pre-authorized, reversible recovery actions: pause nonessential worker jobs; stop job admission under low disk/RAM/thermal pressure; restart a known user-space service with bounded retries; unload/stop optional inference workloads when a supported API exists; preserve logs and crash dumps.
4. Use a circuit breaker. Example: at most one restart per component per window, then quarantine that component and escalate instead of looping.
5. Resume after reboot from a durable journal, run read-only diagnostics first, and report which actions did and did not succeed.
6. Keep a recovery path when the model server is unavailable. The LLM is optional; deterministic rules must still run.

The Guardian must NOT automatically:
- change BIOS/UEFI, firmware, GPU/chipset/storage drivers, Windows boot settings, registry security settings, firewall/remote-access policy, BitLocker, pagefile, or power plans;
- disable Windows security, delete crash dumps, delete unknown files, kill arbitrary processes, execute untrusted repository/web text, or run unrestricted PowerShell suggested by an LLM;
- run database migrations, deploy code, spend money, publish externally, or rotate credentials without the applicable authorization.

### Plane B: Independent Watch / Recovery Coordinator
Runs outside the host (existing GitHub/Render/cloud control surface, if configured and verified) and observes heartbeat freshness. It can:
- mark the host OFFLINE/STALE, stop dispatching host-bound work, preserve queue state and report the last acknowledged job;
- notify through an already-authorized channel and offer the smallest safe recovery procedure;
- on host return, compare last heartbeat, boot ID and journal sequence to identify interrupted jobs and reconcile them idempotently.

It cannot magically heal a dead PC. Out-of-band power-on/reboot requires supported hardware/firmware (for example, a correctly configured remote-management feature) or human intervention. No new paid infrastructure is permitted without explicit authorization.

## Four-stage toll-road factory: what each stage must actually do

### 1. Demand signal → candidate SKU (not automatic truth)
Inputs are source-tagged, timestamped and deduplicated. Candidate clustering may use Jaccard/token similarity as a cheap baseline, but similarity is not buyer intent or willingness to pay. Every candidate needs source provenance, evidence grade, target job, proposed buyer, expected delivery, price hypothesis, confidence and a falsifiable validation test. No automatic public listing from unverified web text.

**Acceptance:** deterministic schema validation; stable SKU ID from normalized identity/version; duplicate detection; provenance and license review; explicit CANDIDATE state. A demand signal never changes revenue.

### 2. Candidate SKU → bounded offer/route contract
Generate OpenAPI/agent manifests from a versioned canonical offer schema, not separate hand-maintained files. Each contract states input/output schema, auth, scope, price/currency, limits, timeout, idempotency key, error codes, data handling, refund/revocation behavior, version and owner. Publish only through the existing doorway/gateway after security and route-parity checks.

**Acceptance:** generated specs validate; route maps to a real handler; production smoke test verifies the deployed commit and custom-domain/gateway parity; stale/unimplemented routes are not advertised as available.

### 3. Payment gate → verified authorization (Stripe and x402 are different adapters)
A generic HTTP 402 response is a challenge, not a payment. Stripe requires a signature-verified webhook or authoritative API reconciliation, exact line-item/SKU/amount/currency checks, event idempotency, and refund/dispute handling. An on-chain x402 adapter must verify the supported chain/network, token contract, recipient, amount, transaction success/finality policy, payment window, resource binding and replay protection against an authoritative RPC/verification service. A caller-supplied transaction hash alone is not proof. Do not describe arbitrary proof verification as constant-time without a concrete, measured implementation.

Keep adapters separate behind one internal PaymentEvidence contract. The contract records provider, external event/transaction ID, resource/SKU, amount, currency/token, verification method, observation time, status, idempotency key and evidence reference. A payment event is not fulfillment and is not automatically revenue until reconciled.

**Acceptance:** valid event grants at most one scoped entitlement; duplicate/replayed/mismatched/refunded/expired events grant none or revoke according to policy; database outage fails closed for paid execution where durable entitlement is required.

### 4. Entitlement → execution → receipt → economics → controlled scale
Only an authorized, scoped entitlement can invoke a bounded handler. Each execution has an idempotency key, quota, timeout, cost ceiling, audit event and user-visible receipt. Failure must return a truthful failure receipt, not a green success. Measure actual delivered value and variable costs before calculating contribution margin.

Bandit allocation (UCB1 or epsilon-greedy) is a later optimization, not a substitute for product validation. It requires clean randomized exposure assignment, stable cohorts, sufficient samples, delayed-conversion handling, refunds, bot filtering, exploration budget and guardrails. Low traffic should produce INSUFFICIENT_DATA, not automatic pruning. Cloning is allowed only for offers with verified positive economics and reproducible fulfillment.

**Acceptance:** replay/refund/quota/concurrency/failure tests pass; independent transaction completes from payment through delivered receipt; margin includes payment fees, inference/GPU, storage, support/refunds and acquisition costs; rollout is staged with kill switch and rollback.

## Scaling law: generate many candidates, deploy few proven roads
“Millions of endpoints at zero marginal cost” is not an operational guarantee. Endpoints consume compute, storage, observability, security review, routing, rate-limit and support capacity. Use a multi-tenant handler and data-driven offer registry where possible, not one service/database schema per SKU. Partition and shard only when measured limits require it. Every generated candidate remains inert until its gates pass. The first scaling unit is a proven reusable route template, not a million public URLs.

## BECK recovery state machine
HEALTHY → DEGRADED → JOBS_PAUSED → DIAGNOSTICS_CAPTURED → SAFE_RECOVERY_ATTEMPTED → HEALTH_RECHECKED → HEALTHY | QUARANTINED | HUMAN_ACTION_REQUIRED

- HEALTHY: required checks pass and fresh heartbeat exists.
- DEGRADED: threshold crossed; stop new expensive/nonessential work.
- JOBS_PAUSED: persist current job/claim/ack state; prevent duplicate execution.
- DIAGNOSTICS_CAPTURED: collect bounded, privacy-aware evidence before changing state.
- SAFE_RECOVERY_ATTEMPTED: only allowlisted reversible actions, with retry ceilings.
- HEALTH_RECHECKED: repeat checks and verify stable window, not one successful ping.
- QUARANTINED: component remains stopped after retry budget.
- HUMAN_ACTION_REQUIRED: driver/hardware/firmware/boot repair or other privileged/high-risk work.

Never let the LLM be the sole detector, approver, executor and verifier of the same recovery. Rules and health probes detect; BECK proposes; policy gates authorize; an executor applies an allowlisted action; independent checks verify; the journal preserves evidence.

## First implementation order
1. **Stabilize host first:** read-only inventory of Windows build, last bugcheck/Event Viewer records, minidumps, Reliability Monitor events, GPU/driver versions, disk health/free space, memory/thermal indicators, scheduled tasks and LM Studio model IDs. Preserve evidence before cleanup. Do not change drivers or BIOS blindly.
2. Add deterministic job admission circuit breakers for low disk/RAM/thermal pressure and host heartbeat staleness.
3. Add durable local journal + startup resume + bounded restart/quarantine behavior.
4. Add independent heartbeat/queue pause so a dead host is never represented as healthy.
5. Re-verify the existing DreamLedger manifest, checkout and probe without creating test checkouts or self-purchases.
6. Prove one independent payment-to-delivery path; only then enable the NZ$19 bridge offer and wider distribution.
7. Add demand-to-SKU generation and bandit optimization only as separately tested components after a reusable offer and execution path is proven.

## Evidence and status vocabulary
Every component and claim must be labeled VERIFIED, OBSERVED, INFERRED, PROPOSED, STALE, CONTRADICTED, TEST, or UNVERIFIED, with timestamp, source, version/commit and test method. Code presence is not deployment; HTTP 200 is not fulfillment; HTTP 402 is not settlement; checkout creation is not payment; a Stripe event is not delivery; a model response is not verification.

## Definition of done
- Host failure is detected from an independent observer.
- On host return, jobs are resumed/reconciled idempotently and interrupted work is not falsely marked successful.
- Blue-screen evidence is preserved and tied to a specific dump/event, not guessed from generic symptoms.
- Safe automated recovery is bounded, reversible, auditable and works without an LLM.
- High-risk repairs require human approval.
- The deployed offer route, settlement, entitlement, execution and receipt pass an independent end-to-end test.
- Only verified positive economics unlock cloning or larger-scale rollout.
- No new ledger, queue, orchestration system or paid service is added to bypass current failures.

**Current status:** architecture contract authored; no claim that host guardian, external watchdog, x402 verification, tenant spawning, bandit allocator or million-route scaling is implemented or production-verified by this document.
