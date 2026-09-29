# DreamLedger Resilience and Independence Doctrine

Status: PROPOSED OPERATING STANDARD
Date: 2026-09-29
Scope: DreamLedger, BrownEye Cortex (BEC/BECK), cloud services, local Windows runtime, payment and evidence paths.

## Mission

Design for expected failure. The system must detect faults, contain them, switch to safe fallback paths, preserve evidence, and recover without requiring the owner to repeatedly bootstrap services or perform physically demanding computer work.

The owner can keep the PC powered on and allocate approximately one hour per day for supervision and maintenance. Routine startup, health checks, retries, reconciliation, backups, and recovery should be automated where safe. Owner attention is reserved for decisions that require human authority.

## Non-negotiable invariants

1. Truth survives outages. Never promote a payment, buyer, fulfillment, or economic outcome without independent evidence and the existing verification gates.
2. Failure is explicit. Every dependency state is HEALTHY, DEGRADED, FAILED, UNKNOWN, or RECOVERING. Missing telemetry is UNKNOWN, never HEALTHY.
3. Retries are bounded and idempotent. Backoff, jitter, timeouts, circuit breakers, and deduplication prevent retry storms and duplicate side effects.
4. Human authority is preserved. Public release, outreach, external spend, live financial actions, and secrets remain gated unless explicitly authorized.
5. Secrets stay out of logs, repository files, prompts, and proof artifacts.
6. No single model, provider, network, machine, scheduler, or chat session is the sole keeper of operating knowledge.
7. No n8n. Use the existing repository, Windows Task Scheduler, GitHub Actions, Supabase, and Render where they fit.
8. Degraded mode must be useful but honest. Queue work, serve cached/read-only outputs, or continue independent functions; stop unsafe financial or public actions when required evidence or authority is unavailable.

## Heartbeat and Figure Eight

Implement layered proof of life, not one green light:

- L0 MACHINE: Windows host reachable; expected boot/session state and disk capacity recorded.
- L1 SUPERVISOR: BECK controller/heartbeat task ran within its freshness window; last result and exit code recorded.
- L2 PROCESS: required local services are listening and report process identity/version.
- L3 APPLICATION: local health endpoint returns expected schema and version.
- L4 DEPENDENCY: cloud dependencies are independently checked with bounded timeouts.
- L5 FUNCTIONAL PROBE: safe, non-financial synthetic/read-only operation proves the critical path works end to end.
- L6 TRUTH PIPELINE: evidence is durably recorded and reconciled; no test event can become real revenue.
- L7 FIGURE EIGHT: independent authority/evidence gate reports its own freshness, inputs, decision, and failure reason. A heartbeat must not self-certify the gate it is meant to supervise.

Heartbeat records should include timestamp UTC, component, version, status, duration, dependency results, last successful functional probe, error class, fallback selected, and correlation/idempotency key. Never log secrets or sensitive payloads.

Use at least two independently scheduled observers where feasible: local Windows Task Scheduler for the local machine and cloud scheduling/monitoring for cloud services. If the PC is offline, cloud monitoring must report LOCAL_OFFLINE rather than imply the full system is healthy. If cloud connectivity fails, local services should retain a bounded local status/evidence queue and replay it idempotently when connectivity returns.

## Fallback contract

For every critical capability, maintain a written contract containing: primary path, independent fallback, degraded behavior, timeout, retry budget, circuit-breaker condition, durable state, recovery procedure, safety boundary, and a test proving the fallback works.

Initial capabilities to inventory:
- scheduling and heartbeat
- model inference
- demand research and external HTTP calls
- Supabase reads/writes
- Render-hosted API execution
- evidence storage and export
- payment intake
- payment-chain verification
- fulfillment and delivery receipt
- Figure Eight / external authority validation
- notification and operator reporting
- source control and deployment

Fallback examples:
- Primary model unavailable: route to an explicitly permitted alternate model/provider; otherwise use deterministic rules or queue the task.
- External research unavailable: use timestamped cached data only with STALE labels; do not present it as current.
- Supabase unavailable: queue only idempotent, non-financial events locally; never claim a durable cloud write succeeded.
- Payment verifier unavailable: preserve PENDING/UNVERIFIED; never promote revenue.
- Fulfillment dependency unavailable: pause the affected offer or queue work within an explicit service limit; do not accept work the system cannot complete.
- Figure Eight unavailable: allow safe internal processing but block actions requiring its authority decision.
- Local PC unavailable: cloud services continue only for capabilities whose dependencies and safety requirements are satisfied; local-only inference is marked unavailable.

## Recovery and resilience tests

Run non-destructive fault-injection tests before calling a fallback complete:
1. Kill or pause the local heartbeat task.
2. Stop the local inference server.
3. Simulate DNS/network timeout and HTTP 429/500 responses.
4. Make Supabase temporarily unreachable or reject a write in a test path.
5. Simulate stale and missing heartbeat records.
6. Replay a duplicate event to test idempotency.
7. Restart the Windows host and verify tasks recover automatically.
8. Interrupt a deployment and verify health checks prevent false success.
9. Simulate payment-verifier outage and confirm revenue remains unchanged.
10. Disable Figure Eight and confirm authority-gated actions stop while safe monitoring continues.
11. Restore each dependency and verify recovery without duplicate side effects.
12. Export evidence and configuration metadata, restore to a clean environment, and run smoke tests.

Never run destructive fault injection against live financial records or production customer transactions. Use isolated test records and explicit environment labels.

## Daily operator budget

Automated daily digest, designed for a short phone review:
- overall and per-layer health
- degraded/failed components and age of last success
- fallback usage and recovery attempts
- stale evidence and unresolved contradictions
- deployment/version drift
- backup/export freshness
- pending human decisions, sorted by consequence
- verified economic scoreboard, unchanged unless the evidence gate passes

Target: routine maintenance should fit inside the owner's approximately one-hour daily window, with no expectation of standing, reaching the PC, or repeatedly running bootstrap commands. Every manual intervention must include a reason, exact action, expected result, rollback, and a low-effort alternative where possible.

## Moat strategy

The moat is not agent count or code volume. Build compounding advantages:
- a trustworthy, independently auditable history of real outcomes
- reliability data about which workflows survive real failures
- reusable fallback and recovery contracts
- low-friction operation with limited owner attention
- portable, provider-neutral interfaces and documented recovery procedures
- verified fulfillment capability before increasing demand
- customer-specific workflow knowledge and repeatable delivery, acquired lawfully and with consent

Do not describe these as a proven moat until customers, repeat usage, retention, or independently verified outcomes demonstrate it.

## Implementation sequence

P0: Inventory existing heartbeat, Windows scheduled tasks, Render checks, GitHub workflows, Supabase evidence tables, and Figure Eight status. Record current truth, not assumptions.
P1: Define one canonical component registry and heartbeat schema; add freshness thresholds and UNKNOWN handling.
P2: Add independent local/cloud observers and an operator digest.
P3: Map every critical capability to primary/fallback/degraded-mode contracts.
P4: Add bounded retries, idempotency, circuit breakers, and durable queues only where missing.
P5: Build isolated fault-injection tests and recovery proofs.
P6: Test clean restore and provider substitution.
P7: Measure outcomes: detection time, recovery time, false-green rate, duplicate side effects, owner interventions per week, and verified external outcomes.

Do not declare a layer complete because code exists or a health endpoint returns 200. Require timestamped, reproducible proof for each acceptance test.

## Current status and honesty

This document is a target operating standard, not proof that these controls are already implemented. Existing services and scheduled tasks must be inspected before changes. Unknown or untested controls remain UNKNOWN/UNVERIFIED. Economic truth remains unchanged until independently verified evidence supports a change.
