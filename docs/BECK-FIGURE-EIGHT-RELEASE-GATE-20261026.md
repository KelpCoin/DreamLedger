# BECK Figure Eight Release Gate Evidence

Captured: 2026-10-26 UTC
Repository: KelpCoin/DreamLedger
Purpose: preserve independently observable blockers and prevent code-complete from being mistaken for production-ready or revenue.

## Gate verdict

**RELEASE_BLOCKED**. No production release, DNS cutover, payment endpoint change, migration cutover, or historical-data deletion is authorized by this evidence record.

## Observed evidence

1. GitHub PR #838, `Add tenant-scoped B2B RFQs and Figure Eight multi-model council`, is open and not merged. Head commit observed: `7c7a0c2129ecb372cc3cd26cdabf4dbc58418afc`. The PR metadata describes a 118-commit change set. Treat it as unverified until required checks and code review pass.
2. GitHub combined commit status for that head reported failures from the Vercel deployment checks. The supplied failure target explicitly contains `upgradeToPro=build-rate-limit`. This is a deployment quota/rate-limit blocker; it does not establish whether application tests pass.
3. The Vercel `dreamledger` project was visible to the connected account. Deployment inspection returned multiple recent `ERROR` deployments on the feature branch. Production content could not be fetched through the connected Vercel tool because Vercel returned HTTP 403 at its deployment-access authorization stage. Therefore production route health is **NOT_VERIFIED**, not assumed broken or healthy.
4. The confirmed Render workspace is `My Workspace`, ID `tea-d7l1ebq8qa3s73fq2cd0`. Render service `DreamLedger1`, ID `srv-d8ud55lckfvc73f1t4eg`, is `suspended` with suspend reason `billing`. Its configured health path is `/healthz`. A deploy request alone cannot establish recovery from a billing suspension.
5. The same Render inventory showed `cube-economic-heartbeat` as not suspended. Its configured command calls a Supabase Edge Function at `/functions/v1/economic-radar-heartbeat`; this dependency remains a migration item, not a completed exit.
6. Supabase project `DreamLedger-Recovery`, ref `kzsinsqfqfmatoqzjxja`, reports `ACTIVE_HEALTHY`. A connected table listing returned zero tables in the `public` schema. This is not proof that all schemas are empty or that source history is absent.
7. A read attempt against the original DreamLedger Supabase project `wbwgroygjeyukkspnqiy` failed with a database connection refusal. No historical data was read or migrated by that failed request.
8. Neon project `dreamledger-migration-staging`, ID `falling-base-50259456`, was visible and reported synthetic storage size zero at inspection. This is a staging resource, not evidence of a complete data migration.
9. The earlier SEO release gate remains: the NZ$29 Commander Diagnostic is held and must not be represented as purchasable until its actual intake, payment attribution, fulfilment, and delivery path is verified. Do not attach Edward Kenway's checkout link to the diagnostic. No `InStock` structured data or diagnostic buy button should be added while held.
10. No independently verified external-buyer transaction and customer-delivery proof was established by these checks. Code, generated research, deployment attempts, and internal tests are not revenue.

## Required gates before calling GREEN

- [ ] Recover source data from the correct origin using a successful, read-only connection or export; inventory schemas, row counts, storage objects, and financial ledger files.
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
