# BECK Figure Eight Release Gate Evidence

Captured: 2026-10-26 UTC
Repository: KelpCoin/DreamLedger
Purpose: preserve independently observable blockers and prevent code-complete from being mistaken for production-ready or revenue.

## Gate verdict

**RELEASE_BLOCKED**. No production release, DNS cutover, payment endpoint change, migration cutover, or historical-data deletion is authorized by this evidence record.

## Observed evidence

1. GitHub PR #838, `Add tenant-scoped B2B RFQs and Figure Eight multi-model council`, is open and not merged. Head commit observed after the compatibility-wrapper commit: `ef65b13c4d55bc1a566878c35a891c75f1ff682c`. The PR metadata reports 119 commits and 46 changed files. Treat it as unverified until required checks and code review pass.
2. GitHub combined commit status for the previous feature-branch head reported Vercel deployment failures with target URLs containing `upgradeToPro=build-rate-limit`. This is a deployment quota/rate-limit blocker; it does not establish whether application tests pass.
3. The latest Vercel deployment metadata reported `readyState=ERROR`, `errorCode=module_not_found`, `errorStep=buildStep`, and `Command "node scripts/verify-vercel-public-release.cjs" exited with 1`. The canonical verifier and every route it checks were independently read from the feature branch and the named static assertions passed. A root-directory mismatch is a plausible explanation, not a confirmed root cause. A compatibility wrapper was committed to `public/scripts/verify-vercel-public-release.cjs` on PR #838; it has not been deployment-verified because the Vercel checks remain blocked by build-rate limits.
4. The Vercel `dreamledger` project was visible to the connected account. Production content could not be fetched through the connected Vercel tool because Vercel returned HTTP 403 at its deployment-access authorization stage. Therefore production route health is **NOT_VERIFIED**, not assumed broken or healthy.
5. The confirmed Render workspace is `My Workspace`, ID `tea-d7l1ebq8qa3s73fq2cd0`. Render service `DreamLedger1`, ID `srv-d8ud55lckfvc73f1t4eg`, is `suspended` with suspend reason `billing`. Its configured health path is `/healthz`. A deploy request alone cannot establish recovery from a billing suspension.
6. The same Render inventory showed `cube-economic-heartbeat` as not suspended. Its configured command calls a Supabase Edge Function at `/functions/v1/economic-radar-heartbeat`; this dependency remains a migration item, not a completed exit.
7. Supabase project `DreamLedger-Recovery`, ref `kzsinsqfqfmatoqzjxja`, reports `ACTIVE_HEALTHY`. A read-only inventory across user schemas returned 27 auth tables, 9 beck tables, 3 realtime tables, 8 storage tables, 1 Supabase migration table, and 1 vault table. There were zero tables in `public`. Estimated live-row counts from `pg_stat_user_tables` were zero for the nine BECK application tables, including payment and fulfilment receipt tables; these are estimates, not an audited row-by-row count. This recovery project does not currently prove recovered customer or revenue history.
8. The original DreamLedger Supabase project, ref `wbwgroygjeyukkspnqiy`, reports `ACTIVE_HEALTHY` in project metadata, but read-only SQL attempts failed with a database connection refusal. The source database's actual application-table inventory and financial rows therefore remain unverified. The failed read did not migrate or change data.
9. Neon project `dreamledger-migration-staging`, ID `falling-base-50259456`, has a primary branch in `ready` state, reported logical size of 32,325,632 bytes, zero reported written-data bytes, and no snapshots. This does not establish source-data parity; the logical size alone is not proof of migrated application records.
10. The NZ$29 Commander Diagnostic remains held. Do not attach Edward Kenway's checkout link to the diagnostic. Do not add `InStock` structured data or a diagnostic buy button while held.
11. No independently verified external-buyer transaction and customer-delivery proof was established by these checks. Code, generated research, deployment attempts, and internal tests are not revenue.

## Required gates before calling GREEN

- [ ] Recover source data from the correct origin using a successful, read-only connection or export; inventory schemas, exact application-table row counts, storage objects, and financial ledger files.
- [ ] Create and checksum a source backup before any migration writes.
- [ ] Restore or replace the deployment host only after the candidate serves the expected release and health endpoints.
- [ ] Resolve Vercel access/build quota issues, then obtain successful CI and production checks for the exact candidate commit.
- [ ] Verify public routes, canonical URLs, noindex/indexing policy, and mobile storefront behavior against live HTTP responses.
- [ ] Apply database migrations to a non-production target first; verify tenant isolation and row-level security with negative tests.
- [ ] Verify payment webhook signatures, idempotency, correct product/price attribution, settlement, fulfilment, and customer delivery end-to-end.
- [ ] Keep the diagnostic held until its release gate passes.
- [ ] Perform DNS cutover only after candidate hosting, TLS, health checks, data parity, rollback path, and domain ownership are proven. Preserve the old provider and data until post-cutover checks pass.
- [ ] Record a real external buyer, payment, settlement, fulfilment artifact, delivery confirmation, and reconciliation receipt before declaring the first-dollar loop complete.

## Operational boundary

This evidence artifact records observations, not permission to spend money, publish externally, change DNS, modify production customer data, delete provider resources, or claim revenue. Re-run live checks before acting because provider state can change.

## Verification

From the repository root, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Verify-BECK-FigureEight-ReleaseGate.ps1
```

Expected result: `EVIDENCE_SCHEMA=PASS` and `RELEASE_GATE=BLOCKED`. A PASS means this local evidence record is structurally consistent; it does not mean production is healthy.
