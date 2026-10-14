# 777 Check: Economic Supervisor Result Contract

**Status: HOLD.** The check identified a deterministic runtime defect and the public paid-API route remains externally unverified. A narrow source repair is proposed; this report does not claim a runtime pass, deployment, sale, or revenue.

- **Bug ID:** `BUG-777-ECON-BOOTSTRAP-ERROR-SHAPE-20261015`
- **Observed failure run:** [GitHub Actions run 38564412036](https://github.com/KelpCoin/DreamLedger/actions/runs/38564412036)
- **Run commit:** `b5a0b86995875f7f016a07f253819a549d9eec99`
- **Uploaded artifact:** [economic-state artifact](https://github.com/KelpCoin/DreamLedger/actions/runs/38564412036/artifacts/11893549237)
- **Target repair commit:** [`5e3988d5acf1`](https://github.com/KelpCoin/DreamLedger/commit/5e3988d5acf1ef10c47c5c589882707d3638d358)
- **Commercial target:** [Issue #490, TOLL-PROBE-50C](https://github.com/KelpCoin/DreamLedger/issues/490)

## Exact symptom and broken contract

The workflow passed Windows PowerShell 5.1 runtime verification and PowerShell/config parsing, then failed in `Run economic supervisor` with:

```
The property 'error' cannot be found on this object.
FullyQualifiedErrorId: PropertyNotFoundStrict,DreamLedger-Economic-Bootstrap.ps1
```

Under `Set-StrictMode -Version Latest`, the successful `SafeGet` result contained `ok`, `status`, and `content` but no `error` key. The caller reads `$r.error` even on successful probes. `SafeJson` had the same inconsistent shape for successful JSON responses, and its callers also inspect `error`.

**Broken contract:** each `SafeGet` and `SafeJson` result must have a consistent `error` field whether the operation succeeds or fails.

## Ten materially different repair paths

| # | Repair | Risk / reversibility | Verification | Expected economic effect |
|---|---|---|---|---|
| 1 | **Selected:** return `error=$null` from successful `SafeGet` and `SafeJson` results. | Low; two-line, easy rollback. | Run the Windows PowerShell 5.1 supervisor; assert success/error result shapes. | Removes the observed crash so one run can produce the actual blocker and complete evidence. |
| 2 | Guard every `.error` property read with `PSObject.Properties` checks. | Low to medium; many call sites to maintain. | Search every error-property access and test success/failure paths. | Prevents this class of crash but spreads defensive logic through callers. |
| 3 | Use hashtable indexer access `$r['error']` at every call site. | Low; reversible, but changes many call sites. | Exercise missing-key and populated-key cases under StrictMode. | Avoids missing-property exceptions; doesn't enforce a uniform result contract. |
| 4 | Add a single `New-HttpResult` factory that always emits `ok,status,content,data,error`. | Medium; requires consolidating helper return paths. | Unit-test every factory branch. | Reduces future repair loops by centralizing response semantics. |
| 5 | Return typed `PSCustomObject` results from all helpers. | Medium; broader compatibility surface. | PowerShell 5.1 tests for every object shape and call site. | Better discoverability, but more change than needed for this blocker. |
| 6 | Add a `Get-OptionalProperty` helper and replace direct property reads. | Medium; adds an abstraction. | Test null, missing, success, and failure cases. | Increases fault tolerance but adds another mechanism to maintain. |
| 7 | Relax or remove StrictMode. | High; masks other missing-property defects. | Would let the current line proceed without proving the contract. | Rejected: hides defects instead of improving revenue-path reliability. |
| 8 | Catch `PropertyNotFoundException` around caller reads and continue. | High; likely to turn faults into misleading partial success. | Failure injection and reconciliation tests. | Rejected: risks false green status and incomplete evidence. |
| 9 | Add an environment preflight that emits structured `BLOCKED` evidence for absent integration settings. | Low to medium; separate follow-up after the shape fix. | Run with absent/present variables and verify redacted presence flags. | Exposes the next blocker instead of aborting; does not fix this exception alone. |
| 10 | Add Pester tests for helper result contracts under StrictMode. | Low runtime risk; requires test harness availability. | Run tests in Windows PowerShell 5.1 CI. | Prevents regression and cuts repeated debugging time. |

## Selected repair and implementation

The branch applies repair #1 only:

- Successful `SafeGet` now returns `error=$null`.
- Successful `SafeJson` now returns `error=$null`.
- Error branches continue to return their actual error messages.
- No production service, secret, Stripe setting, public page, payment, or database was changed.

This is the smallest repair consistent with the observed stack trace. It is a source change, not a claim of a successful runtime test.

## 777 gate results

| Gate | Result | Evidence / reason |
|---|---|---|
| G0 Scope | PASS | One bounded, read-only supervisor defect. |
| G1 Demand/value | PARTIAL | The existing NZ$0.50 toll experiment is documented, but that is not proof of an independent buyer or current buyer intent. |
| G2 Authority | PASS for this repair | Read-only inspection plus reversible branch/PR only; no payment, public launch, live configuration, or production deployment. |
| G3 Provenance | PARTIAL | Run ID, commit, and provider log are retained; the failed run uploaded only `01_SYSTEM_HEALTH.json`, not the full evidence bundle. |
| G4 Safety/security | PARTIAL | No secret values were written to the report and no financial side effect was performed; full security tests were not run. |
| G5 Determinism | FAIL | The supervisor crashed while reading a missing `error` property. PowerShell syntax and config parsing did pass. |
| G6 External truth | BLOCKED / UNVERIFIED | The failed run did not complete reconciliation. Stripe was not configured in that runner invocation. Render request logs show `/api/toll/v1/manifest` returning 503 at 2026-10-14T06:46:21Z, 08:13:54Z and 12:29:31Z, and 307 on other requests. Current route truth needs a fresh successful observation. |
| G7 Fulfilment | UNVERIFIED | No settled buyer order, successful authenticated probe, or attributable delivery receipt was verified. |
| G8 Reconciliation | UNVERIFIED | No completed Stripe-to-entitlement-to-probe-to-receipt reconciliation occurred. |
| G9 Economics | BLOCKED | Verified external revenue remains NZ$0.00. Stripe paid-candidate reconciliation did not run because `STRIPE_SECRET_KEY` was blank in the failed runner. |
| G10 Promotion | HOLD | Hard gates failed or remain unknown; do not promote the offer based on this run. |

## Integration blockers visible in the workflow log

The run showed these environment entries blank: `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `AGENTBRIDGE_TOKEN`. `SUPABASE_SECRET_KEY` was present but masked. No secret values are recorded here.

The existing Render gateway and DreamLedger1 services both had recent deployment failures with event type `pipeline_minutes_exhausted` (including 2026-10-14T11:58:29Z). That blocks deploying a gateway correction through those Render services until the deployment-capacity issue is resolved without unapproved spend. The source code on GitHub is not evidence that the latest source is running in production.

## Verification and remaining transition

- **Read-back/static patch assertions:** PASS. Both successful result-return expressions were found once and updated.
- **Windows PowerShell runtime retest on patched code:** NOT RUN. This environment has no PowerShell executable; the existing GitHub runner used Windows PowerShell 5.1, but the changed branch has not been executed there.
- **Current economic state:** `VERIFIED_EXTERNAL_REVENUE = NZ$0.00`.
- **Remaining blocker:** run the patched supervisor in an authorized Windows PowerShell 5.1 CI job, then address absent integration configuration and restore a directly observed 200 response from the canonical paid-API manifest/probe path. Do not add more silos or parallel truth systems.
- **Next highest-value action:** get one successful read-only supervisor run and one authoritative manifest observation before touching payment/entitlement settings. Keep all live financial actions approval-gated.
