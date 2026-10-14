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
