# Elohim-led Runtime Environment Setup

Date: 2026-10-10
Status: Environment contract documented; live local/cloud runtime setup and end-to-end execution NOT YET VERIFIED.

## Authority hierarchy
1. Elohim: upstream objective-setting, opportunity discovery, prioritization, strategy refinement, and repair decisions within approved policy.
2. CUBE: downstream production substrate. Converts Elohim objectives into bounded work using existing jobs and Agent Bridge mechanisms; it does not command Elohim.
3. Swarms: parallel workers claim independent scoped work from the existing dispatch surfaces.
4. Gauntlet: evaluates the exact artifact/action against quality, evidence, silo, rights, privacy, platform, and authorization rules.
5. Digital Proxy: executes only the exact payload and destination bound to a valid Gauntlet PASS and active authorization.
6. Evidence/observation: records provider responses and independently checks external state; feeds verified outcomes and failures back to Elohim.
7. Owner: sets goals and explicitly authorizes protected policy envelopes. Routine actions inside an installed and tested envelope do not require repeated per-action approval.

## Runtime rules
- Reuse the existing DreamLedger CUBE/public.jobs and Agent Bridge dispatch surfaces. Do not add another queue, ledger, orchestrator, or truth system.
- Treat cloud persisted state as authoritative and local LM Studio as an optional acceleration worker. Cloud execution requires configured credentials and approved spending limits.
- Never treat internal routing, a Gauntlet PASS, or a dispatch attempt as proof of an external action or revenue.
- Preserve silo boundaries and bind every external action to an explicit destination, policy version, and payload hash.
- Require idempotency, bounded retries, expiry, revocation, audit receipts, and a kill switch for authorized external actions.
- Keep identity, consent, payment, account access, payout/KYC, legal commitments, new destinations, and actions outside the active envelope behind human approval.
- Default external spend to NZ$0 unless a funded and explicitly authorized limit is installed.
- Elohim may repair and resubmit denied work, but cannot bypass a denial or expand its own authority.
- Revenue is verified only through independently evidenced external payment, correct attribution, fulfillment, and proof.

## Environment bootstrap sequence
1. Read AGENTS.md and AGENT_BUS/BRIDGE/PROTOCOL.md; inspect existing handoffs and the existing job registry before claiming work.
2. Identify the current Elohim entry point, CUBE/public.jobs worker, Gauntlet decision path, Digital Proxy dispatch path, and existing evidence observer. Record file paths and actual runtime commands.
3. Confirm local runtime prerequisites without exposing secrets: OS, Python/Node versions as applicable, Git state, LM Studio/llmster endpoint and loaded model, and whether the PC worker is reachable.
4. Confirm cloud prerequisites and health endpoints without changing production configuration or spending money.
5. Run unit/contract tests for allow, deny, expired/revoked policy, changed payload, wrong silo, unknown destination, duplicate action, timeout/retry, provider rejection, and external-result mismatch.
6. Run dry-run end to end: Elohim objective -> existing CUBE job -> worker artifact -> Gauntlet receipt -> blocked/no-send proxy simulation -> observation artifact.
7. Enable a narrow real external action only after an explicit authorization envelope exists, tests pass, and the exact destination/action/schedule/limits are approved.
8. Save machine-readable proof and a human-readable handoff. Mark each stage distinctly; never collapse documented, installed, tested, dispatched, externally observed, and paid into one status.

## Required status labels
- DOCUMENTED: rules are written.
- DISCOVERED: actual runtime entry points and dependencies identified.
- CONFIGURED: environment values and endpoints are set without exposing secrets.
- TESTED: automated tests pass.
- DRY_RUN_VERIFIED: complete internal path produces evidence without external side effects.
- AUTHORIZED: bounded envelope explicitly approved.
- EXTERNAL_RESULT_OBSERVED: independent evidence confirms the provider-side result.
- REVENUE_VERIFIED: external payment, attribution, fulfillment, and proof all reconcile.

## Current verified state
- This file documents the intended setup and rule hierarchy.
- AGENTS.md says existing CUBE/public.jobs and Agent Bridge are the executable dispatch surfaces; do not invent a second queue.
- runtime/economic/production_observation_contract.py and production_observation_probe.py are read-only observation contracts, not a full autonomous runtime.
- The Gauntlet/Digital Proxy owner-bottleneck canon exists, but runtime enforcement is explicitly NOT YET VERIFIED.
- This repository-level edit does not configure the user's desktop, connect services, execute a deployment, or prove revenue.

## First implementation target
Trace the real Elohim -> existing job dispatch -> worker -> Gauntlet -> Digital Proxy -> independent observer path in the checked-out repository. Prefer repairing and connecting existing modules over introducing new architecture. Report the first concrete runtime blocker with evidence and continue all independent authorized work.