# PhinHaven implementation contract (v0.1)

**Status:** architecture proposal; implementation and production deployment remain unverified.  
**Parent system:** KelpCoin/DreamLedger canonical silo architecture.  
**Rule:** reuse the existing DreamLedger/Supabase/commerce/evidence substrate where it fits. Do not create a parallel ledger, queue, scheduler, identity system, or orchestration framework.

## Product thesis
PhinHaven is an original persistent strategy economy inspired by high-level systems patterns: production and upgrades, agent collection/progression, deterministic event resolution, cooperative coordination, contested territory, and seasonal content. Do not copy Top Heroes' art, characters, text, exact UI, proprietary data, or branding. Create original rules, assets, names, and balance.

## North Star
Every meaningful progression or commerce event should have a traceable lineage and a truthful status. Receipts establish integrity of recorded claims, not the real-world truth of the event by themselves.

## MVP delivery order
1. **Static product page**: explain the concept and label unimplemented features honestly.
2. **Single-player economy sandbox**: one settlement, three resources, a small original agent roster, build prerequisites, deterministic upgrade/event transitions, save/reload.
3. **Event receipt prototype**: event ID, subject, event type, rules version, before/after state hashes, evidence hash, issuer identity/signature, timestamp, truth label. Test tamper detection and duplicate idempotency.
4. **Authority and safety boundary**: authenticated owner actions, server-side validation, no browser-held service secrets, rate limits, audit trail, kill switch, prompt-injection-resistant handling of user-generated content.
5. **Cooperative thin slice**: one guild task, help contributions, a short race, deterministic reward calculation, concurrency-safe award path.
6. **Payments only after a real entitlement is necessary**: test-mode first; verify Price ID, currency, amount, metadata, paid state, settlement, entitlement and fulfillment independently. No VIP/spending tiers are assumed validated.
7. **Production hardening**: observability, backups/restore drill, incident runbook, dependency/security scans, privacy/retention rules, access review, load tests, rollback and release gates.

## Canonical data concepts
Reuse existing project schema where possible. Candidate domain concepts, not permission to create tables before inspecting the live schema:
- settlement/building: owner, level, upgrade state, prerequisites, production rule version
- resource balance: owner, resource type, amount, version
- agent: original stable ID, role, attributes, progression tracks
- economy event: event ID, idempotency key, inputs, rules version, outputs, status
- contribution: actor, group, action, target event, validated reward
- receipt: event ID, evidence hash, signature key ID, truth label, verifier result
- entitlement/payment: canonical offer, buyer identity, provider event, settlement observation, fulfillment evidence

## Truth labels
VERIFIED / UNVERIFIED / CONTRADICTED / STALE / TEST / SIMULATED / INTERNAL / UNMATCHED. Never label a simulation as a real user outcome. Never count an unlinked payment as PhinHaven revenue.

## MVP acceptance tests
- resource arithmetic and upgrade prerequisites are deterministic and property-tested
- concurrent requests cannot spend the same resources twice or issue duplicate rewards
- duplicate provider/event deliveries are idempotent
- stale or unauthorized writes are rejected server-side
- receipt signature and hashes fail verification after tampering
- rules-version changes are recorded
- client cannot choose arbitrary reward amounts or entitlement state
- all public metrics are sourced from actual records and carry a freshness timestamp
- emergency kill switch blocks state-changing operations and leaves read-only status available
- production deploy can be rolled back and the restore process is tested

## BECK and autonomous desktop work
- BECK remains the internal immutable evidence/ledger role, not a second database or an invented payment oracle.
- Cloud remains authoritative; desktop LM Studio is an optional worker and can be offline without stopping cloud operation.
- Workers claim bounded tasks before editing; one active writer per target path; record base commit, branch/commit, artifacts, tests, truth label, blocker and next owner.
- No agent may perform account, identity, consent, payment, credential rotation, domain transfer or other authority-sensitive action without the existing authorization gate.
- Automation must stop on missing evidence, stale base SHA, invalid signature, failed tests, secrets exposure, or unexpected external effects.

## Deploy gates
**MVP deploy:** static page and sandbox only; no claims of multiplayer, signed production receipts, or revenue.  
**Full deploy:** all security, concurrency, backup/restore, observability, identity, receipt-verification, rollback, and payment/fulfillment acceptance tests pass in the target environment.  
**Production verified:** independent live smoke tests pass for the exact domain, every critical route, auth boundary, state transitions, receipts, billing/fulfillment where enabled, alerts, and rollback. A green GitHub check alone is insufficient.

## Immediate blockers / next actions
1. Confirm the Render workspace before service/domain inspection; current candidate workspace is My Workspace, but it has not been selected by the user.
2. Verify the new DreamLedger static site source and CI status.
3. Deploy preview/staging, run mobile and route smoke tests, then inspect the domain mapping before switching the apex.
4. Restore read-only Supabase schema inspection through a supported pooler or SQL editor before writing migrations.
5. Inspect existing BECK/evidence/lease primitives before implementing PhinHaven state or receipt storage.
