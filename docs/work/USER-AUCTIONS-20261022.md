# User auctions: bounded implementation job

Owner: Codex. Parent: DreamLedger general human/agent marketplace request.
Status: LOCAL_VERIFIED; CLOUD_PENDING. Base: origin/main, 2026-10-22 inspection.

Scope: replace unsafe JSON auction behavior with transactional SQLite auction storage;
mount authenticated auction routes in both existing Node entrypoints; replace the
sample-lot auction UI with actual seller creation, browsing and bidding; regression
coverage and PowerShell verifier. No production publication or payment activation.

Reuse: existing DreamLedger Node runtime, account password records, auction surface,
AJV dependency and marketplace integrity CI. PR #790 remains a Supabase alternative;
PR #804 catalogue/reservation files and PR #777 migration files are outside this job.
BrownEye-CUBE search returned no auction implementation. Do not create another queue.

Acceptance: authenticated seller draft -> reviewer approval -> two-user bids -> close
-> exactly one payment-pending order. Tests cover concurrent equal bids, retries,
changed replay, self-bid, expiry, reserve, inventory allocation, private drafts and
no fabricated listings. Use Node's GitHub-maintained SQLite runtime and AJV validators.

Deployment limitation: this is a Node 24 persistent-disk adapter, not a Cloudflare
Workers deployment. Existing legacy account lifecycle requires separate security
migration; public enablement stays gated. No invented buyers, revenue or deployment.

Automation: reuse Cloud Elohim Website Gauntlet and its existing proposer/critic/
synthesizer runner. Each PR runs deterministic auction tests and retains evidence.
Model review is advisory, capped at three calls and 1500 output tokens per call;
missing model secrets produce an explicit blocked artifact. No automatic merge,
deployment, payment activation or second work queue. Local auction suite: 11/11 PASS.
Browser QA and live payment validation remain NOT_RUN.

User expanded acceptance: publish visible website changes and repair CI (2026-10-22).
Scope now includes fixing observed compiler/schema/layout drift, public auction route
and authenticated proxy wiring, homepage source preservation, held-product checks,
manifest hashing and test-secret fixture. No tests are disabled to claim green.
Local full compile and Gauntlet pass in isolated checkout; auction tests 11/11,
existing npm test 20/20. Cloud review credentials absent in first run. Existing
production storefront is Render-backed; deployment awaits CI and workspace selection.

## Cloud repair follow-up

The cloud run on `789e1207` passed the Elohim compile, worker proof, core Gauntlet, and all 11 auction tests. Remaining surface-contract failures are repaired against the actual storefront: automatic avatar persistence, current MTG feed, published/held catalogue checkout policy, and the versioned toll API. Changed action runtimes use Node 24. Local verification passed all 11 auction tests, changed YAML parsing, server syntax, and HTTP checks for home/auctions (200), unavailable engine (503), missing product (404), and held product (409).

Production is still BLOCKED: the selected Render workspace reports the dynamic storefront billing-suspended. Existing Cloudflare migration PR #777 lacks deployment credentials and has unresolved data migration gates; this branch does not bypass it. Cloud model review emitted BLOCKED_MISSING_MODEL_CONFIGURATION (zero model calls), although the deterministic Elohim compiler and Gauntlet ran in GitHub Actions. A green advisory step is not proof of a model review or a live deployment. Nine pre-existing malformed workflows were found outside this change; restoring dormant automation requires reviewing their actions, rather than silently activating it.
