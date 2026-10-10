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


## Batch 3–8 follow-up review (2026-10-10)

### Repository inspection findings

- The repository already contains supabase/functions/quote-intake/index.ts. It retrieves the Stripe Checkout Session from Stripe and checks live mode, paid payment status, the configured Payment Link, expected SKU metadata, and corresponding revenue_orders, revenue_entitlements, and fulfillment_requests rows before accepting quote inputs.
- That function calls quote-fulfillment after the buyer finalizes inputs. This is an existing buyer-journey path; do not replace it with the pasted standalone stripe-webhook.ts without tracing the currently configured Stripe webhook endpoint, deployed functions, and existing schema first.
- The proposed path supabase/functions/stripe-webhook/index.ts and supabase/config.toml were not found at those exact repository paths during this inspection. That does not prove no webhook exists elsewhere; search the full repository and Stripe endpoint configuration before modifying routing.
- The current .github/workflows/777-cycle.yml is GitHub-hosted (ubuntu-latest) and has a frequent cron schedule. It does not depend on a self-hosted Windows runner. Adding a local runner is therefore not required to unblock the existing cloud pulse workflow, and a PC-offline runner cannot repair a GitHub-hosted run stuck before job creation.

### Corrections to the proposed scripts

1. **Pooler diagnosis:** Test-Connection/ICMP is informational only. The acceptance test is a successful PostgreSQL connection using the exact dashboard-provided transaction-pooler hostname, username, database, port, and secret. Port 6543 is not a universal replacement for every connection mode or migration workflow; verify the chosen pooler mode and its prepared-statement/transaction constraints. Do not infer the cause of the earlier refusal from IPv6 alone.
2. **SQL probe:** avoid matching output with the letter "t". Use psql -X -A -t -v ON_ERROR_STOP=1 and compare normalized scalar output exactly to t; check the native process exit code after each invocation. Set a connection timeout and require TLS where supported. Never print the connection URI.
3. **Schema migration:** the proposed table's defaults make an event look processed before side effects finish. Use explicit receipt/processing/completion timestamps and a state machine. RLS plus a service_role grant does not itself validate access policy or deployment safety.
4. **Atomicity:** Supabase client calls issued separately do not create a shared PostgreSQL transaction. Put the claim and all database side effects behind a database function/RPC or another transaction-capable server-side implementation. Enforce unique constraints on Checkout Session/order and entitlement/fulfillment relationships. On transient failure, permit safe retry; do not return a success response that suppresses Stripe retries while work remains incomplete.
5. **Payment semantics:** checkout.session.completed alone is not sufficient evidence of settled funds for every payment method. Validate the expected event/payment status and configured accepted payment methods; independently reconcile with Stripe before counting revenue.
6. **Runner setup:** do not put a broad push-to-main workflow on a self-hosted machine until repository/runner-group restrictions and least privilege are established. Do not store the pooler URL in source control or user-wide environment variables if it contains a password. Use an approved secret store. A registered runner and a healthy runner service are distinct states.
7. **Workflow diagnosis:** queued-with-no-jobs is evidence to investigate, not proof that the run is permanently orphaned. Inspect jobs, timestamps, repository runner/Actions status, and API response before cancellation or support escalation. A self-hosted runner does not bypass a GitHub workflow run that never schedules a job.
8. **False-green proof:** status completed must only be emitted after every required check passes. Include per-check results and explicit cloud, local_worker, database, webhook, and fulfillment states. A missing or stale local heartbeat must be OFFLINE/STALE, not healthy.

### Next execution gates

- First inspect configured production Stripe webhook endpoints, deployed Supabase Edge Functions, relevant migrations, and schema constraints for revenue_orders, revenue_entitlements, and fulfillment_requests.
- Add cloud-hosted, secret-free tests for receipt correctness and PC-offline behavior before any local runner is activated.
- Probe the Supabase transaction pooler read-only only after provider/database status is confirmed and an authorized secret is available.
- Test the existing quote-comparison path in Stripe test mode, including duplicate event delivery, retry after partial failure, one order per Checkout Session, and one fulfillment per paid order.
- Do not apply the pasted migration, deploy a new webhook, enable live webhook routing, or claim the loop is closed until these gates are evidenced.

Current status remains: reviewed source text and repository files only. No local bootstrap, self-hosted runner registration, Supabase connection, migration, Stripe webhook delivery, or paid fulfillment has been executed or proven.
