# BECK: MVP and Full Deployment Contract

**Status:** source changes committed; production deployment and desktop execution are not yet verified.

## North Star

BECK is DreamLedger's internal evidence and operating substrate. It must not become a second ledger, queue, or orchestration system. Reuse the existing economic observation contract, Agent Bridge, Cloud Elohim, Cloud Gauntlet, commerce rails, settlement evidence, and fulfillment records.

The desktop is an optional accelerator. Cloud operation must continue when the desktop is offline.

## MVP deployment

1. Serve the redesigned public homepage from the existing storefront's canonical root route.
2. Serve /about/ and /trust/ from the existing storefront process.
3. Preserve existing catalogue, checkout, API, MTG, FightEdge, and toll-road routes.
4. Run offline public-site contract tests and Node syntax checks in CI.
5. Deploy from the existing Render storefront service and smoke-test the public domain and all three pages.
6. Keep the revenue scoreboard at NZ$0.00 until independent settlement, attribution, fulfillment, and evidence agree.

## Full BECK deployment

1. Verify existing cloud service health and version; record commit and deployment identifiers.
2. Verify existing Agent Bridge, Cloud Elohim, Cloud Gauntlet, and current authority gates.
3. Inspect the existing Supabase schema through a working connection before applying any migration. Direct IPv6 connection failure is not proof of a database outage; test the configured session pooler or Dashboard SQL editor.
4. Contain the previously identified legacy Stripe webhook-secret exposure through the authorized secret-rotation procedure. Never put secrets in source, logs, issue comments, or receipts.
5. Require payment attribution by stable buyer and offer identifiers, server-side amount/price validation, idempotent settlement ingestion, and atomic/concurrency-safe ledger append using existing canonical data structures.
6. Require a causal evidence chain from demand and authorization through settlement, entitlement, fulfillment, delivery, and independent proof.
7. Remove empty-signal scheduled runs. A cycle must discover/query real signals before scoring candidates, and must write observable run state even when downstream HTTP calls fail.
8. Prove signed Agent Bridge receipts, enforced lease/fencing at the write boundary, replay protection, least privilege, and safe prompt/tool boundaries before enabling wider unattended writes.
9. Run end-to-end acceptance tests with test-mode transactions first. Never promote tests or simulations into production economic truth.

## Desktop worker

scripts/beck-desktop-worker.ps1 runs local verification and reports status under the current user's LocalAppData. It may fast-forward the checkout only when the working tree is clean. It does not publish externally, spend money, alter credentials, or claim revenue. LM Studio is optional.

Install for the current Windows user:

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\beck-desktop-worker.ps1 -InstallTask

Run once for a visible diagnostic:

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\beck-desktop-worker.ps1 -Once

The desktop worker is committed source, not proof that it has been installed or executed on the user's PC. A local session or remote desktop management channel is required to install it without user action.

## Deployment acceptance

- [ ] Canonical domain serves the new homepage, not the legacy storefront hero.
- [ ] /about/ and /trust/ return HTTP 200 with current content.
- [ ] Existing purchase, API, MTG, and toll routes still work.
- [ ] Desktop worker test run has a saved status report and no unexpected writes.
- [ ] Cloud cycle has a successful, inspectable workflow run with completed job logs.
- [ ] Database read access works through an approved path; schema changes have been inspected before mutation.
- [ ] Webhook signing-secret exposure is contained.
- [ ] Settlement-to-fulfillment evidence chain passes idempotency and concurrency tests.
- [ ] No test/simulated/internal event is labeled as real external revenue.

## Known blockers

- The Render workspace/service/domain mapping still requires explicit workspace confirmation before inspecting or changing live infrastructure.
- Public production deployment is not yet externally verified.
- The desktop worker cannot be installed remotely from a Git repository alone.
- Verified external revenue remains NZ$0.00.
