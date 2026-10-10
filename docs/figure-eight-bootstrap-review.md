# Figure Eight bootstrap and closed-loop implementation review

Date: 2026-10-10
Status: REVIEWED — NOT EXECUTED; PC reported offline

## Decision

Do not run the supplied bootstrap or register a self-hosted runner yet. The design is a useful draft, but it currently permits false-green health results and exposes a personal workstation to remote workflow execution. The local loop is not closed until the acceptance checks below pass.

## Defects to fix before activation

1. **Runner trust boundary.** A self-hosted runner executes repository workflow code with the host's permissions. Do not run untrusted pull-request code on it. Restrict runner groups/repositories, use a dedicated least-privilege Windows account, avoid administrator execution for routine jobs, and require protected-branch review. Prefer ephemeral runners for untrusted work. A PC that is powered off is unavailable; a schedule does not wake it.
2. **False-green workflow.** The workflow sets `status = "completed"` without checking every required command's exit code. Use `$ErrorActionPreference = "Stop"`, explicitly check `$LASTEXITCODE` after native commands, and only write a success receipt after all required checks pass. On failure, write a failure receipt and exit nonzero.
3. **No implicit completion claim.** The receipt must say what actually ran and must distinguish `cloud`, `local_worker`, `database`, `stripe_inbox_schema`, and `fulfillment`. Include timestamp, commit SHA, run ID, runner identity, per-check status, and evidence paths. Do not label a runner job as proof of end-to-end revenue.
4. **Supabase secret handling.** Configure the exact connection URL from the Supabase Dashboard as an Actions secret. Never commit it, echo it, place it in artifacts, or include it in process/log output. Start with read-only `SELECT 1`; database recovery and any write test are separate gates.
5. **Stripe inbox schema is not a webhook implementation.** The proposed table defaults `status` to `processed` and `processed_at` to now before the handler has necessarily completed processing. Use explicit states such as `received`, `processing`, `processed`, `retryable_failed`, and `permanent_failed`; store receipt and completion timestamps separately. Claim an event ID with a unique constraint, verify Stripe signatures, make fulfillment idempotent, and test duplicate delivery, crash/retry, and concurrent delivery. Do not enable the live endpoint until handler-level tests pass.
6. **False-positive table test.** `$inboxOutput -match "t"` can match unrelated text. Parse the scalar query result exactly and fail closed. Verify native command exit codes.
7. **Bootstrap idempotency gaps.** `Test-Command` checks whether a command is on PATH, not whether the requested package is installed or the required version is supported. Validate every tool, clone/pull failures, runner archive hash/signature where published, and BEC command exit codes. Avoid blindly rebasing or modifying a worktree with local changes.
8. **RLS and grants.** Enabling RLS and granting `service_role` is not a substitute for reviewing ownership, policies, API exposure, and service-role-only access. Do not run migrations until database recovery is confirmed and the migration is reviewed.
9. **Ledger integrity.** Presence and line count are not integrity checks. Only mark it verified when the actual verifier returns a machine-readable success value and exit code zero.
10. **Scheduling and graceful degradation.** Cloud CI must independently publish local-worker state. Missing/stale heartbeat means `OFFLINE` or `STALE`, never `HEALTHY`. Test the PC-offline case with a simulated absent worker: no local routing, no false completion, work remains queued or fails clearly, and recovery does not duplicate side effects.

## Safe execution order

1. Cloud-only CI lint and unit tests; no secrets and no production writes.
2. Add a health receipt schema and tests for missing/stale local heartbeats.
3. Add a simulated-offline integration test and upload its machine-readable report.
4. Run a read-only Supabase pooler probe using an authorized secret; redact connection details.
5. Review and test the Stripe inbox handler, including idempotent fulfillment, in test mode.
6. Verify the quote-comparison buyer journey and delivery path end-to-end in test mode.
7. Only after these pass, request explicit approval for any production payment configuration change.
8. Enable the self-hosted runner only with a documented trust boundary and least privilege.

## Acceptance criteria

- No success receipt can be produced if a required command fails.
- Cloud health and local-worker health are separate, timestamped states.
- Simulated PC-offline test proves no local task is falsely marked complete.
- CI artifacts contain no secrets or personal data.
- Stripe duplicate/retry/concurrency tests prove one fulfillment per eligible paid order.
- No production payment webhook or database mutation is enabled merely because a schema exists.
- Revenue remains zero until external settlement, delivery, and attribution are independently evidenced.

## Current truth boundary

The supplied scripts were reviewed as text only. They have not been run on the user's PC. The user's PC is reported offline. This review does not establish runner registration, database connectivity, successful workflow execution, deployment, or revenue.
