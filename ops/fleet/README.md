# BECK Fleet Runtime

This folder defines the cloud-first health and job contracts for BECK. The cloud is primary; the Windows LM Studio worker is optional and does not gate cloud liveness.

## Current components

- `JOBS.v1.json` is the machine-readable job and acceptance contract.
- `heartbeat.mjs` performs read-only HTTP GET probes and writes redacted JSON evidence.
- `neon-sql-probe.mjs` runs only `SELECT 1` through the PostgreSQL client. It never performs database writes.
- `heartbeat.contract.test.mjs` validates health semantics with an ephemeral loopback fixture server.
- `.github/workflows/beck-fleet-contract.yml` runs secretless tests and builds a deliberately fail-closed non-production preview.
- `.github/workflows/beck-cloud-fleet.yml` is the scheduled cloud monitor and guarded recovery controller.
- `../local/Install-BECK-Fleet.ps1` is the supported per-user Windows task installer.

## Cloud execution rules

The scheduled workflow runs from `main` only. Adding the workflow to a feature branch does not activate its cron schedule; the workflow must be merged before the default-branch scheduler runs.

Required GitHub repository secrets for full provider checks:

- `NEON_API_KEY`
- `NEON_PROJECT_ID`
- `NEON_ENDPOINT_ID`
- `NEON_DATABASE_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`
- `CLOUDFLARE_DEPLOY_HOOK_URL` for the deploy action
- `CLOUDFLARE_PREVIEW_URL` for preview probes where configured

Missing secrets are recorded as blocked configuration; a workflow cannot manufacture a provider account, secret, connection string, or domain attachment.

Neon SQL recovery is attempted only after a classified connectivity failure, with a one-hour cooldown and at most one state-aware provider mutation per run. The adapter's provider response is not considered database health; the workflow re-runs the read-only SQL probe after a recovery attempt.

Cloudflare recovery is gated by the machine-readable route contract. While the contract status is `PARTIAL_READ_ONLY_RUNTIME_IMPLEMENTED_DYNAMIC_COMMERCE_BLOCKED`, the deploy hook is not called. The preview intentionally returns HTTP 503 for dynamic commerce and webhook routes that have not been ported. This protects the existing public commerce runtime from being replaced by an incomplete static preview.

The workflow keeps recovery evidence for 30 days. Evidence excludes provider credentials and raw provider response bodies. Failed probes and missing credentials produce a failed/blocked health gate rather than a green result.

## Local worker

From the root of a DreamLedger checkout, run once in Windows PowerShell 5.1:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\local\Install-BECK-Fleet.ps1
```

The installer idempotently registers a per-user task every 30 minutes. LM Studio remains loopback-only at `http://127.0.0.1:1234/v1`. When the PC or LM Studio is unavailable, the local proof says so; cloud operations continue independently. The local orchestrator's plan remains `UNVERIFIED` and never counts as payment or revenue evidence.

## Economic boundary

These components do not publish, contact buyers, alter Stripe configuration, change DNS, or assert revenue. Verified DreamLedger revenue remains NZ$0 unless independent settlement, attribution, fulfillment, and delivery evidence reconcile.
