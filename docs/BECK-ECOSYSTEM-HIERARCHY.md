# Brown Eye Cortex Krinkle (BECK): System Hierarchy and Silo Boundaries

## Canonical hierarchy

The canonical inward-facing name is **Brown Eye Cortex Krinkle (BECK)**, named after the user's dog. BECK is the inward-facing orchestration, telemetry, memory/evidence, scheduling, and system-improvement layer. It is not a customer-facing product and must not be treated as a single commercial silo.

The hierarchy is:

1. **Elohim** — top-level direction, candidate generation, refinement, and judgment.
2. **Brown Eye Cortex Krinkle (BECK)** — inward-facing intelligence and operating layer. Coordinates work, observes evidence, schedules resources, proposes improvements, and routes bounded tasks to the correct vehicle.
3. **Special-purpose vehicles (SPVs)** — independent products and applications with their own product boundaries, data, permissions, deploys, user promises, commercial records, and release gates.

**DreamLedger is one SPV among several**, not the parent of the whole ecosystem. AMPLISSA, the game, and future applications are separate SPVs.

## AMPLISSA is a permanently separate silo

AMPLISSA is an adult-content creator platform. It must remain logically, operationally, and commercially separate from DreamLedger and the game. Shared orchestration does not imply shared customer data or shared authorization.

Required separation:
- Separate application/deployment boundary, configuration, domain routing, access controls, and operational runbooks.
- Separate database schema or project with dedicated least-privilege service roles and explicit RLS/storage policies. Never reuse DreamLedger service-role credentials in AMPLISSA.
- Separate private media storage, media keys, signed URL policy, retention rules, upload pipeline, moderation and takedown evidence.
- Separate creator identities and sensitive verification records. Public creator handles must not expose legal identity. Do not copy identity documents into BECK memory, general telemetry, prompts, or DreamLedger tables.
- Separate commerce provider account/configuration where required by provider terms and risk controls, separate product catalog, entitlement records, settlement reconciliation, refunds, chargebacks, and accounting.
- Separate terms, privacy notices, creator agreements, content-rights/consent records, age/identity verification process, moderation, appeals, and jurisdiction eligibility.
- Separate logs and analytics with strict redaction. BECK may receive allowlisted operational status and aggregate metrics, not raw adult media, identity records, intimate content, or private creator data.
- No cross-silo user tracking, data pooling, or ad-targeting by default. Any future data exchange must be purpose-limited, documented, and explicitly authorized.
- A failure or suspension in one SPV must not grant it permissions over another SPV or bring down unrelated applications.

## Shared infrastructure allowed

BECK may provide shared, product-agnostic services where safe: job scheduling, GPU allocation, CI orchestration, health aggregation, evidence formats, generic observability, and sandboxed code review. These services must use per-SPV workload identities, scoped permissions, isolated secrets, explicit data contracts, and auditable access.

Shared code libraries are acceptable; shared secrets, raw customer data, media stores, or implicit cross-product permissions are not.

## Resource scheduling

BECK schedules cloud resources as the durable control plane. A local GPU worker is optional acceleration, not a source of truth. Customer-paid work, security/privacy incidents, and committed delivery obligations outrank product development; product development outranks speculative self-improvement. Self-improvement jobs must be bounded, preemptible, sandboxed, and evaluated before promotion.

Idle hardware may run approved tests, synthetic data generation, accessibility checks, build tasks, or candidate patches. It may not scrape or ingest private creator content, publish content, change payment settings, expose secrets, or deploy production code without the required authorization.

## Commercial truth remains vehicle-specific

Each SPV keeps its own commercial evidence and scoreboard. A shared dashboard may aggregate verified facts, but it must preserve the originating SPV and evidence references. Never count internal jobs, checkout sessions, PaymentIntents, test transactions, or database rows as settled revenue.

For every SPV, retain the chain:
REAL DEMAND -> REAL BUYER -> AUTHORIZED ACTION -> EXTERNAL RESULT -> SETTLED PAYMENT -> FULFILLMENT -> DELIVERY/EVIDENCE -> VERIFIED.

A blocker must stop only the action that depends on it. It must not stop unrelated, safe work across the ecosystem.

## Governance and change safety

- Elohim proposes and judges candidates; BECK coordinates execution; each SPV retains its own release and authorization boundaries.
- All autonomous changes begin in a branch or sandbox and include tests, provenance, and rollback instructions.
- No autonomous weakening of authentication/RLS, no secret exposure or rotation, no provider-policy evasion, no public posting, live financial action, irreversible action, or production deployment outside explicit authorization.
- Unknown means hold the risky action and continue independent safe work.
- Record only evidence actually observed. A deployment, commit, green health check, or test-mode transaction does not prove end-to-end commercial success.

## Product registry starting point

| Vehicle | Purpose | Isolation requirement |
|---|---|---|
| AMPLISSA | Adult creator platform for BBW/SSBBW and other eligible adult creators | Highest sensitivity: isolated media, identity/consent, moderation, access and commerce |
| DreamLedger | Economic engine and its own offers/services | Its own commercial ledger, customer data, entitlements and release controls |
| Game | Game product and related assets | Separate user, build, telemetry and release boundary |
| Future SPVs | New special-purpose applications | Register an explicit owner, purpose, data classes, secrets, permissions, commercial truth and kill switch before launch |

This document is the governing architecture contract for the ecosystem. Product-specific specifications must conform to it.
