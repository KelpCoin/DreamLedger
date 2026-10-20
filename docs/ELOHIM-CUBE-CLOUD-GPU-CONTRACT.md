# Elohim-first Cloud Runtime and Optional Figure 8 GPU Contract

Status: implementation contract; not a claim that every runtime dependency is currently healthy.

## Required execution topology

1. Elohim creates and versions the silo package, offer, pricing assumptions, policy, and acceptance contract.
2. Cloud CI and cloud application services validate the package and run ordinary generation, routing, storage, and evidence work without a personal PC or GPU.
3. Cube Swarm schedules bounded jobs from approved Elohim packages. Jobs have idempotency keys, timeouts, retry ceilings, concurrency caps, explicit budgets, and machine-readable states.
4. Gauntlet checks package provenance, tenant isolation, economic/policy constraints, and acceptance tests before release promotion.
5. DreamLedger's existing authorized commerce and fulfillment paths handle buyer transactions. Truth Oracle reconciles independent settlement, attribution, fulfillment, and retrievable delivery evidence.
6. Figure 8 local/GPU capacity is an optional worker pool. It can accelerate eligible CPU/GPU inference and batch research, but cloud queues, ledgers, public routes, and core health must not depend on the local worker being online.

## Worker boundary

- Cloud owns the durable queue, job state, canonical evidence references, retries, deadlines, and release authorization.
- The worker claims a bounded job, checks the Elohim package version/hash, runs only the declared capability, and returns output plus input/output hashes, model/runtime identity, timestamps, and exit status.
- A worker must not receive production payment credentials unless a separately approved task strictly requires them. The current opportunistic GPU research worker must remain isolated from Stripe, Supabase, production writes, customer messaging, and publishing.
- Local inference is loopback-only by default. Do not expose LM Studio to the public internet. Do not use the GPU worker as the only scheduler or source of truth.
- Missing worker, unavailable model, malformed response, timeout, or hash mismatch becomes an explicit SKIPPED/BLOCKED result; cloud execution continues with a declared fallback or records that the capability is unavailable.
- GPU jobs are opt-in and bounded by concurrency, timeout, output size, and an explicit $0.00 incremental-spend ceiling unless separately approved.

## Release and economics

- Preview/test execution may run within already-authorized infrastructure.
- Production releases, external messages, spending, payment configuration changes, and permission changes remain explicitly approval-gated.
- Generated pages, model outputs, CI success, clicks, and checkout starts are not revenue.
- Revenue remains unchanged unless independent buyer, provider-confirmed settlement, correct attribution, fulfillment, and buyer-retrievable delivery proof reconcile through the existing canonical evidence boundary.
- Do not create a second queue, payment ledger, silo registry, price catalog, or truth oracle. Inspect and reuse existing canonical components.

## Acceptance criteria

- Cloud CI passes without a self-hosted runner or GPU.
- The GPU worker can be absent without blocking cloud deployment or business workflows.
- The worker health check uses an explicit boolean and model count, not substring matching.
- Offline or empty-model states skip safely and emit an artifact.
- All network calls have timeouts; all outputs are bounded and attributable to the exact job/package.
- Tests never alter production state or economic truth.
