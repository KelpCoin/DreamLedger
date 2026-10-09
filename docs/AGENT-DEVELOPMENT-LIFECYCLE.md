# DreamLedger Agent Development Lifecycle (ADLC)

Status: proposed operating contract; implementation and live execution remain unverified until the acceptance test below passes.

## Purpose

Make the public DreamLedger website a downstream artifact of the existing Elohim, Gauntlet, BECK, CI/CD, and production-observation substrate. Do not create a parallel queue, ledger, orchestration layer, or truth system.

## Lifecycle

1. **Discovery**: Elohim selects one bounded change tied to user value, commercial utility, reliability, or security. Record the source, expected benefit, confidence, and a kill condition.
2. **Experimentation**: test the smallest safe hypothesis using local or staging artifacts. Mark all synthetic inputs and outputs as TEST or SIMULATED. No public claim or external side effect follows from an experiment alone.
3. **Specification and build**: Gauntlet emits a versioned machine-readable specification. The specification must define target paths, permitted operations, required tests, prohibited operations, resource limits, provenance, rollback behavior, and acceptance conditions. BECK rejects work without a valid specification.
4. **Validation and deployment**: run deterministic checks and relevant adversarial/security tests. Deploy only artifacts that match the accepted spec and pass all required checks. Public deployment is restricted to explicitly configured deployment targets; payment, account, credential, outreach, and spend actions remain behind existing authority gates.
5. **Operational steady state**: observe deployment health and artifact integrity. On failure, capture evidence, classify the failure, create a bounded remediation proposal, test it in isolation, and redeploy only after the same gates pass. Limit retries and use rollback or mark UNKNOWN when recovery cannot be verified.

## Required artifact contract

Every change must retain:
- change_id and idempotency_key
- source intent and provenance references
- specification version and content hash
- allowed paths and side-effect class
- preconditions, resource/time limits, network policy, and secret-access policy
- test commands and expected results
- build/deployment identifiers and observed target
- before/after artifact hashes where applicable
- rollback plan and retry limit
- evidence references and timestamps
- final state: PROPOSED, READY, RUNNING, WAITING_AUTHORITY, BLOCKED, DEPLOYED, ROLLED_BACK, FAILED, or UNKNOWN
- truth classification: VERIFIED, UNVERIFIED, CONTRADICTED, STALE, TEST, SIMULATED, INTERNAL, or UNMATCHED

A state transition is recorded only when its evidence is observed. A requested deployment is not a deployed artifact; a successful CI run is not proof of production health; an internal test is not an external result.

## Authority and safety boundaries

- No agent may grant itself new permissions.
- No access to host secrets from generated or tenant-controlled code.
- External network access is allowlist-only unless separately authorized.
- Build and repair jobs have bounded retries, timeouts, output limits, and a kill switch.
- Public content must pass source/provenance checks, link checks, quality checks, and duplicate/thin-content checks.
- Deployments must be reversible and target-specific.
- Identity, consent, payment, credential, account, spend, external outreach, and other explicitly governed actions require the existing authority mechanism.
- If the evidence is incomplete, report UNKNOWN or UNVERIFIED; never infer success from intent or process completion.
- Economic truth remains governed by the existing production observation contract and Truth Oracle. This lifecycle cannot promote internal work into revenue.

## First acceptance test: bounded website change

Use a harmless, deterministic change in a non-sensitive staging or preview surface, such as updating a displayed maintenance/version label.

1. Elohim records the intent and expected value.
2. Gauntlet emits a schema-valid specification with exact allowed path(s), tests, and rollback instructions.
3. BECK rejects a deliberately malformed or out-of-scope spec.
4. BECK executes the valid spec in an isolated branch/worktree.
5. CI proves the expected change occurred and unrelated files did not change.
6. A deliberately failing test demonstrates fail-closed behavior and prevents deployment.
7. A passing test permits preview deployment only.
8. An independent HTTP/content observation confirms the deployed artifact and records its hash.
9. A rollback test restores the prior artifact and independently verifies the result.
10. Receipts link the intent, spec hash, code commit, test report, deployment ID, observation, and rollback evidence.

**Pass condition:** all ten steps have independently inspectable evidence. If the real BECK path, preview deployment, or production observation endpoint is not available, the test is BLOCKED or UNVERIFIED, not simulated into a pass.

## Operational steady-state policy

- Prefer deterministic repair for known failure signatures; use an LLM to propose a diagnosis or patch, not to self-certify it.
- Require the verifier to be separate from the generator wherever feasible.
- Cap autonomous repair attempts per incident; after the cap, quarantine the candidate and leave a compact evidence packet for later review.
- Notify a human only for an actual authority gate, a high-impact/security incident, or exhausted bounded recovery. Batch non-urgent reports.
- Keep an append-only record of lifecycle transitions in the existing canonical evidence surfaces. Do not add a competing event store.

## Current proof status

This document is a specification, not evidence of an operational agent. AgentBridge remains unverified end-to-end until a real task is claimed by a live worker, executed, and independently reconciled from the canonical queue and worker receipt. The 777 GitHub Actions run using DETERMINISTIC_FALLBACK does not prove a live model-backed agent or AgentBridge dispatch.

Verified external revenue remains governed by the canonical economic scoreboard and is not affected by ADLC acceptance.
