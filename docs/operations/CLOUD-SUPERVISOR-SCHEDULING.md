# DreamLedger cloud supervisor scheduling

**Authority:** Supabase Postgres Cron.  
**Fallback:** GitHub workflow_dispatch / external scheduler only when the database scheduler is unavailable.  
**Target job:** `dreamledger-commerce-supervisor-15m`.  
**Target function:** `commerce-supervisor`.  
**Status:** migration prepared in source control; not yet applied to the production database.

## Why this changes

The repository has scheduled GitHub Actions workflows, but a recent private-repository incident reported that `schedule` runs were not enqueued while manual `workflow_dispatch` runs worked. GitHub's current official documentation does **not** establish a general rule that scheduled workflows are disabled for all GitHub Free personal-account private repositories. The report should be treated as a real observed scheduler failure, not as authoritative proof of a plan-wide product policy.

DreamLedger should not make its durable commerce heartbeat depend solely on GitHub's hosted scheduler. Supabase Cron runs from Postgres, records job history in `cron.job_run_details`, and can enqueue requests to Edge Functions through `pg_net`. References:
- https://supabase.com/docs/guides/cron/quickstart
- https://supabase.com/docs/guides/database/extensions/pg_net
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

## One-time secure setup

The migration reads the service-role JWT from Supabase Vault at job execution time. The value must never be committed into this repository or stored in a workflow file.

In the Supabase Dashboard for project `wbwgroygjeyukkspnqiy`, create a Vault secret named exactly:

`dreamledger_supervisor_service_role_key`

Use the existing legacy `service_role` JWT that the function's `verify_jwt: true` configuration accepts. Do not use a publishable key. Do not put the key into chat, GitHub source, SQL source control, logs, or the migration. If the project uses only the newer non-JWT secret API key, this caller/auth contract must be deliberately changed before applying the migration.

The migration fails loudly if required extensions are unavailable. The scheduled command fails visibly if the Vault secret is missing or blank. It does not fall back to an unauthenticated public endpoint.

## What the job does

Every 15 minutes, Postgres Cron reads the Vault secret and sends an authenticated POST to `/functions/v1/commerce-supervisor`. The function reconciles commerce cells against paid order and fulfillment records, records its run and next action, and does not create revenue from page views or checkout starts.

This scheduling layer is not itself proof that the underlying reconciliation is correct. Job run status, the function response/logs, table readback, and end-to-end order evidence must all be checked.

## Versioned supervisor implementation

The repository now includes the source intended for the next Edge Function release at `supabase/functions/commerce-supervisor/index.ts`. It tightens the previous deployed implementation in four ways:

- checks both the bearer token and `apikey` against the service-role secret, because `verify_jwt: true` by itself can accept an ordinary signed-in user's JWT;
- reads data in explicit pages and fails visibly at the configured bound instead of silently treating PostgREST's default response limit as a complete result;
- picks the strongest observed state once per SKU (`FULFILLED` supersedes `PAID`) instead of emitting two transitions from the same original state in a single tick;
- uses `apply_commerce_supervisor_transition` so the state update and its audit-event insert commit or roll back together, with optimistic concurrency protection.

The paired migration `20261014191000_commerce_supervisor_atomic_transition.sql` grants that RPC only to `service_role`. Apply the atomic-transition migration **before** deploying supervisor source v2. Do not deploy the v2 function in isolation: it intentionally fails closed if the RPC is missing.

## Live status at this execution pass

The database project reports `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.127. However, read-only SQL/catalog inspection timed out during this pass, so the Vault secret and installed Cron job could not be confirmed by live read-back. The query window checked in Supabase's function logs returned no matching `commerce-supervisor` entries for 2026-10-14 08:00–08:50 UTC. That absence is not proof the function never ran, but it is not positive heartbeat evidence either.

Accordingly, source validation is not labelled runtime readiness. Do not treat a queued GitHub workflow, an Edge Function listed as ACTIVE, or a prepared migration as proof that the 15-minute cloud tick is operating. The live sequence still required is: apply atomic-transition migration, confirm or create the Vault key through the dashboard, apply the Cron schedule migration, deploy v2 with JWT verification enabled, and verify an actual successful run plus state/event read-back. If Supabase's database connection continues timing out, leave the scheduler un-certified rather than guessing.

## Verify after the migration is applied

Run these read-only queries in the Supabase SQL editor:

```sql
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'dreamledger-commerce-supervisor-15m';
```

```sql
select jobid, runid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'dreamledger-commerce-supervisor-15m'
)
order by start_time desc
limit 10;
```

And review outbound Edge Function requests in `net._http_response` for non-2xx responses. A successful cron enqueue is not enough: the function must actually complete and persist its run record.

## Failure behavior

- No Vault secret: cron job run fails with a clear exception; no call is made.
- Function returns non-2xx or cannot reach the database: inspect the function execution logs and the cron/network response.
- No fresh `commerce_supervisor_runs` entry: heartbeat is not proven.
- A run is recorded but `next_action=REPAIR_SELLABILITY`: scheduler is running, but the commerce path is still blocked.
- A real settled transaction is still required for verified revenue.

## QR campaign planner

`BEC-PRIME/distribution/QR-CampaignPlanner.js` generates tracked QR variants and a machine-readable campaign plan. It is safe to run during CI or a manual cloud tick because it prepares assets and records policy gates only. It does not post, email, DM, join communities, buy ads, or bypass venue/channel permissions. First-party fulfillment assets can be included automatically; third-party placement remains prepare-only until permission is recorded.
