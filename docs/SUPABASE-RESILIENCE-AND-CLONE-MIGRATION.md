# Supabase resilience and clone migration policy

Status: proposed, fail-closed. This document does not claim a standby is online or that any database has been replicated.

## Immediate routing rules

1. `wbwgroygjeyukkspnqiy` (DreamLedger, ap-southeast-1) remains the sole write authority until a separately versioned promotion event says otherwise.
2. Never fail over writes to another Supabase project merely because the primary returns 5xx, ECONNREFUSED, or times out. A different project is not a replica unless schema, data, auth, storage, secrets, and replication lag have been measured.
3. When the primary is unavailable, callers must fail closed for authoritative writes and enqueue retryable work durably where a tested durable outbox exists. Never acknowledge fulfillment or settlement before the authoritative operation and evidence are confirmed.
4. Read fallback is allowed only for explicitly classified, non-sensitive, stale-tolerant reads against a verified read-only replica. It is not a general replacement for the primary.
5. Recovery requires fencing the old primary, confirming replica freshness, applying one explicit promotion, and running smoke tests before writes resume. No active-active writes and no split brain.

## Required fallback layers

| Tier | Purpose | Status |
|---|---|---|
| 0 | Primary DreamLedger Supabase project | Current authority; dashboard status alone is not an RPC health proof |
| 1 | Same-project read replica, if provisioned and useful | Not verified as provisioned; read-only and not a write failover |
| 2 | Independent warm-standby Postgres/Supabase project with continuous or scheduled replication | Not verified; must not receive production writes yet |
| 3 | Encrypted, off-project database backups plus WAL/PITR where available | Backup registry exists in Git; actual recent database backup/restore is not proven by that registry |
| 4 | Durable local/cloud outbox for retryable jobs | Must be independently durable and replay-tested; GitHub Actions logs are not an outbox |
| 5 | Provider-independent export and restore runbook | Migration files exist; a full restore drill is not proven |

Multiple fallbacks are intended, but they are not interchangeable. A backup is recovery, not instant failover. A read replica is not a writable standby. An inactive project is not a standby.

## Known Supabase project inventory

Observed from the connected Supabase project list on 2026-10-12:

- `wbwgroygjeyukkspnqiy` — DreamLedger, ap-southeast-1, ACTIVE_HEALTHY in project metadata. Prior worker evidence includes HTTP 503 from PostgREST and direct SQL ECONNREFUSED. Keep as the sole write authority, but do not call the data plane healthy until RPC/SQL smoke tests pass.
- `kgwhmnxnhkslrdgebpmf` — thebrowneye, ap-southeast-1, INACTIVE. Candidate clone only; not a fallback.
- `uaudjnkbpqcavmyihker` — TheBrownEye, ap-southeast-1, INACTIVE. Candidate clone only; not a fallback.
- `sclmcmsugijgcuaftqlh` — mtg singles, ap-south-1, INACTIVE. Candidate clone only; not a fallback.
- `aiejisszfzcgblguxnly` — BECK Beauty Academy, ap-southeast-2, ACTIVE_HEALTHY. Separate named product/project; do not repurpose as DreamLedger standby without explicit product/data separation approval.

A database migration inventory query failed with ECONNREFUSED while this policy was prepared. Therefore clone schema parity, data freshness, Auth users, Storage objects, secrets, extensions, and migration history remain unverified. Do not route production traffic to these projects.

## Clone migration sequence

For each candidate clone, in order:

1. Restore/activate through the Supabase dashboard or provider-supported recovery path, then prove direct SQL and Data API health. Do not treat project-list status as sufficient.
2. Take a fresh recoverable backup of the source and target before changing either.
3. Compare migration history, table/column/index/function/trigger/RLS policy inventories, extensions, Edge Function versions, Auth configuration, Storage buckets/objects, secrets, webhook URLs, and scheduled jobs.
4. Apply the repository's versioned migrations to a non-production target first. Do not blindly replay all migrations against an unknown clone.
5. Copy data using a supported export/import or replication method, with row counts, key checksums, and referential-integrity checks. Keep secrets out of Git and rotate target credentials independently.
6. Run read-only smoke tests and representative RPC tests. Prove idempotency, RLS, Stripe webhook signature handling, and no duplicate settlement/fulfillment.
7. Keep the target read-only until a human-approved cutover. Fence the old writer before promotion. Record source/target refs, migration head, backup ID, lag, validation evidence, operator, and UTC timestamp.
8. Run a restore/failback drill before declaring resilience green.

## Required health gate

A project is eligible for service only after all applicable checks pass:
- HTTPS Data API health request with valid project credentials.
- Direct SQL query via a supported connection route.
- A read-only schema/migration inventory query.
- A harmless representative RPC or transaction rolled back safely.
- Replication/backup freshness and restore evidence.
- Correct project identity and region.
- No stale or conflicting writer; promotion/fencing state is explicit.

Until then, status is `UNVERIFIED`, not healthy. This policy must be adopted by all DreamLedger service clones before any are considered production-ready.

## Current decision

Do not automatically promote any of the three INACTIVE projects. The current evidence is insufficient to know whether they are complete clones, stale snapshots, or different product states. The safe immediate enforcement is to preserve one write authority, reject unverified failover, and build/test the standby before migration or cutover.
