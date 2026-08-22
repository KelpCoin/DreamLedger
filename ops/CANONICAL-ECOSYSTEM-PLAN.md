# DreamLedger canonical ecosystem policy

## Canonical source

The only active source repository is `KelpCoin/DreamLedger`.

`KelpCoin/DreamLogic` is a migration source and retirement target. New code, offers, workflows, deployment configuration, proofs, and runtime changes belong in DreamLedger only.

The migrated source is retained under `legacy/DreamLogic` for auditability. It is not a production runtime.

## Failure removal rule

Every critical stage has one primary path and at least three independently useful fallbacks:

| Stage | Primary | Fallback 1 | Fallback 2 | Fallback 3 |
| --- | --- | --- | --- | --- |
| Source | DreamLedger/main | local working copy | GitHub commit history | migrated DreamLogic archive |
| Build | GitHub Actions canonical compile | local PowerShell/Node build | cached npm dependencies | immutable source commit |
| Runtime | Render | GitHub Pages static surface | GHCR immutable container | local Windows runtime |
| Payment | Stripe live Payment Link | Stripe Dashboard/manual checkout | alternate approved payment link | invoice/manual settlement |
| Evidence | GitHub proof artifacts | D:\BrownEyeCortex proof | Stripe live object evidence | local verification logs |
| Deployment trigger | GitHub Actions | Render API | Render deploy hook/dashboard | local/manual release |

## Truth rules

A deployment is not production-proven until the live hostname is independently verified.

A payment link is sellable only when Stripe reports it active.

Revenue is recorded only when Stripe reports a completed paid transaction.

A fallback may preserve availability, evidence, or recovery. It must never silently replace the canonical runtime without recording which path is active.

## Economic priority

The system should optimize for the next independently observable economic event, not for feature count.
