# DreamLedger Figure Eight Bootstrap and Recovery Runbook

**Status:** isolated implementation branch; not deployed to production.  
**Purpose:** give BECK one repeatable, evidence-producing bootstrap and make cloud/local failures distinguishable without inventing a PC power state.

## Architecture and authority

- **Cloud half:** public routes, approved catalogue, canonical payment/settlement processing, durable economic records, and production liveness probes.
- **Local half:** the Windows host, LM Studio, the three-role proxy, local generation, and bounded adversarial checks.
- **Crossing:** GitHub branches, CI/test results, and hash-linked proof artifacts.
- **Truth rule:** local inference, a successful HTTP response, a generated product, or a Gauntlet PASS is not revenue. Verified revenue requires an independent buyer, processor settlement, correct SKU and silo attribution, fulfilment, delivery evidence, and independent verification.
- **Failover:** cloud monitoring continues when the PC is unavailable. Work requiring local compute must pause, queue, or use an approved alternative. Economic truth never depends on the local model's self-report.

## Why the PC may appear offline

A missing heartbeat proves only that the cloud has not received a fresh heartbeat. It does **not** distinguish a powered-off computer from sleep, loss of network, a failed scheduled task, LM Studio not being loaded, a stopped proxy, or a failed authentication/configuration path.

Software running on a powered-off computer cannot start that same computer. Remote power-on requires a separately configured mechanism, such as firmware scheduled power-on, Wake-on-LAN from a reachable device on the same network, or out-of-band hardware management. This bootstrap intentionally does not alter BIOS/UEFI, power plans, drivers, firewall, remote-access settings, or Windows security policy.

## Run the bootstrap

From the checked-out DreamLedger repository, open ordinary (non-administrator) PowerShell and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Start-BECK-FigureEight.ps1
```

It checks Node.js, LM Studio's OpenAI-compatible endpoint, the local tri-LLM proxy, configured model roles, GPU telemetry, local Git state, and live website, engine, gateway, and heartbeat endpoints. It writes a JSON report and log under:

- `D:\BrownEyeCortex\Runtime\proofs\figure-eight\` if D: exists
- otherwise `$HOME\BrownEyeCortex\Runtime\proofs\figure-eight\`

To request starting an already-installed LM Studio application if its model API is unavailable:

```powershell
.\scripts\Start-BECK-FigureEight.ps1 -StartLMStudio
```

To register a limited-privilege, per-user task that runs at logon:

```powershell
.\scripts\Start-BECK-FigureEight.ps1 -InstallAtLogon
```

The task starts after a user logs on. It **cannot power on a shut-down PC** and does not configure automatic login. Remove it with:

```powershell
Unregister-ScheduledTask -TaskName 'DreamLedger-BECK-FigureEight' -Confirm:$false
```

## Authenticated local heartbeat

The implementation on this branch adds `GET /api/toll/v1/local-heartbeat` for status and `POST /api/toll/v1/local-heartbeat` for authenticated operational presence. The POST requires a dedicated bearer token, `LOCAL_HEARTBEAT_TOKEN`, at least 32 characters long, configured both in the engine's secret manager and in the local user's secure environment.

Provision the token directly in the hosting provider's secret UI and Windows user environment. Never commit it, put it in chat, paste it into the repository, or print it in logs. Do not weaken authentication if it fails. The heartbeat status expires after five minutes. It is operational telemetry only and cannot authorise checkout, fulfillment, publication, or revenue claims.

This branch does not set secrets or alter production service configuration. The live Render pipeline has been failing with `pipeline_minutes_exhausted`; until a deploy containing this code is verified, the live heartbeat route is not expected to reflect this branch.

## First validation sequence

1. Run `node --test BEC-PRIME/routes/tollRoad.local-heartbeat.test.js`.
2. Parse the PowerShell script without executing it:
   ```powershell
   $tokens=$null; $errors=$null
   [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path '.\scripts\Start-BECK-FigureEight.ps1'),[ref]$tokens,[ref]$errors) | Out-Null
   if($errors.Count){$errors | ForEach-Object { $_.Message }; throw 'PowerShell parse failed'}
   ```
3. Run the bootstrap once on the actual PC and retain the generated JSON proof.
4. Confirm the deployed version endpoint matches the intended commit, then verify the heartbeat POST and TTL status against that deployment.
5. Only after deployment and cloud tests pass should a separate, explicitly approved production configuration change install the token and activate the optional local heartbeat.

## Current external blockers

As checked on 16 October 2026, the latest Render deployments for `dreamledger-org` and `dreamledger-silo-gateway` failed with `pipeline_minutes_exhausted`. The DreamLedger Supabase data-plane query timed out during this inspection; current heartbeat rows and ledger durability therefore remain unverified. The bootstrap records these as blockers rather than claiming a healthy Figure Eight.

## Economic investigation handoff

Every investigation run should create an append-only handoff with: incident ID and timestamp, exact error signature, environment and service identity, source commit and deployed SHA, names-only secret presence inventory, code-path trace, log/source references, root-cause confidence and counter-evidence, proposed minimal repair, deterministic test plan, approval requirement, owner, and next verification command.

The investigation worker is read-only by default. It may collect and correlate evidence, but cannot read or output secret values, rotate secrets, deploy, publish, spend, issue checkout, or change payment/settlement state. A proposal is not a repair; a green test is not a production proof; a production health check is not a sale.

## Current economic truth

Verified external revenue stays **NZ$0.00** unless the independent buyer → settled payment → SKU/silo attribution → fulfillment → delivery → independent verification chain is evidenced. This bootstrap creates no payment attempt and no public post.
