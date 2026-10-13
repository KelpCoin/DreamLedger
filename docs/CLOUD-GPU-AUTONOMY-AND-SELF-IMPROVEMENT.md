# Cloud-First GPU Scheduling and Bounded Self-Improvement

## Objective

Use cloud services as the durable control plane. When an authorized local Windows machine is online and its GPU/LLM runtime is healthy, it may accelerate queued jobs. When local hardware is offline, the cloud continues with available low-cost workloads and does not assume local capacity exists.

The same scheduler serves AMPLISSA, DreamLedger, the game, and other approved applications without creating separate ledgers or conflicting truth systems.

## Priority order

1. **Safety and incident response:** security vulnerabilities, data loss, payment integrity, privacy, abuse/takedown requests.
2. **Committed user work:** creator uploads, customer-paid jobs, and delivery obligations, in due-date order.
3. **First-dollar commercial proof:** repair and test payment -> settlement -> entitlement/quota -> fulfillment -> external evidence. Keep live transactions approval-gated.
4. **Production reliability:** backups, restore tests, availability, observability, and security-policy remediation.
5. **Product delivery:** AMPLISSA MVP, then the highest-evidence DreamLedger and game milestones.
6. **Demand research and asset preparation:** evidence-backed offers, landing-page experiments, synthetic test data, accessibility, and documentation.
7. **Self-improvement:** only when higher-priority queues are empty or below their reserved capacity.

## Capacity model

- Reserve a configurable slice of available compute for production/committed work.
- Run self-improvement as preemptible, bounded jobs. Cancel or pause it when a higher-priority job arrives.
- Never keep a GPU busy solely to maximize utilization. Idle is acceptable when no useful, authorized work exists.
- Prefer local GPU inference for privacy-sensitive drafts and bulk evaluation when the PC, power, model, and temperature checks pass.
- Prefer cloud CPU for lightweight coordination and cloud GPU only when expected benefit justifies cost. No new paid infrastructure or GPU rental without explicit spend authorization.
- Expose queue depth, estimated job cost, job age, device heartbeat, model availability, and completion evidence in one operations view.

## Safe self-improvement loop

1. Observe: gather verified errors, user friction, test failures, accessibility gaps, and demand evidence.
2. Propose: produce a small patch or experiment with a hypothesis and expected measurable outcome.
3. Isolate: create a branch or sandbox; never edit production in place.
4. Evaluate: run unit, integration, security, privacy, policy, and regression checks relevant to the change.
5. Judge: Gauntlet rejects unsupported claims, unsafe access changes, secret exposure, missing tests, and economic-state manipulation.
6. Human gate: require approval for live purchases, public posts, production deployment, payment/provider changes, legal commitments, personal data exposure, or irreversible actions.
7. Promote: merge/deploy only through the established protected pipeline and authorized policy.
8. Measure: compare the observed outcome with the hypothesis. Revert regressions and preserve the evidence.
9. Learn: retain only reproducible, privacy-safe findings.

## Hard boundaries

- No self-modifying production code, autonomous secret rotation, weakening RLS, disabling authentication, bypassing provider policy, or altering revenue classifications.
- A green health check is not proof of commerce. A checkout session or PaymentIntent is not settled revenue.
- Every economic claim must preserve the existing chain: real demand -> real buyer -> authorized action -> external result -> settled payment -> fulfillment -> delivery evidence -> verification.
- Never upload creator media, identity records, access tokens, payment secrets, or private customer data into a model prompt unless a documented, approved processing path requires it.
- Failed jobs must fail small, be idempotent, and leave a useful diagnostic record.
- Unknown means hold for that specific risky action, not stop all unrelated development.

## Minimum implementation contract

- A single cloud-owned scheduler and durable queue with priorities, leases, retries, cancellation, and idempotency.
- A local heartbeat agent that reports only allowlisted facts: device online, GPU capacity class, model IDs, health, and current job ID. No secrets or arbitrary filesystem inventory.
- Signed/allowlisted task manifests and explicit per-task input/output locations.
- Separate queues for production work and self-improvement, with self-improvement preemptible.
- Job artifacts carry source commit, model/runtime version, test results, hashes, resource use, and approval status.
- The local agent cannot independently grant itself new permissions or deploy to production.
- If Supabase is unhealthy, pause writes and use a durable, explicitly configured fallback queue; do not silently fork truth.
- Start with read-only telemetry and synthetic tasks, then enable reversible file generation in a sandbox after tests pass.

## Rollout

1. Audit existing GitHub Actions, Render, Supabase, and local heartbeat components to reuse working parts.
2. Define one machine-readable task envelope and priority/approval policy.
3. Implement a dry-run scheduler report and local heartbeat.
4. Prove task preemption and resume behavior with synthetic jobs.
5. Add sandboxed website/test improvements.
6. Add evidence-backed product work and only later allow approved production promotion.

## Success metrics

- No missed paid delivery because self-improvement consumed capacity.
- Every job has an owner, priority, budget, timeout, cancellation path, and evidence artifact.
- Local GPU use is opportunistic, observable, and optional.
- Improvements reduce measured failures or user effort, not merely increase commits or tokens.
- No secret exposure, unauthorized production changes, or false revenue claims.
