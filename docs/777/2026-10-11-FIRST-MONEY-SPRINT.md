# 777 First-Money Sprint — 2026-10-11

## Mission
Make the first independently verified DreamLedger sale the only P0 outcome. Work toward a sale today, but do not promise or fabricate one. No new services, databases, paid infrastructure, SKUs, self-purchases, or public campaign launches before the existing route is repaired and its value delivery is proven.

## Commercial truth at start
- VERIFIED_EXTERNAL_REVENUE: NZD 0.00
- Independent external buyers: 0 verified
- Settled attributable payments: 0 verified
- Paid fulfilled orders / verified outcomes: 0 verified
- The GitHub issue #490 notes dated 2026-10-11 record the custom-domain manifest returning HTTP 200, while the Render gateway manifest and checkout still returned HTTP 503. This is a recorded check, not a fresh live probe from this document.
- Treat every URL, checkout, deployment, catalog row and internal event as UNVERIFIED until rechecked.

## The one-money-path decision
1. Keep TOLL-PROBE-50C at NZD 0.50 as the existing low-friction interoperability experiment.
2. Keep AGENT-BRIDGE-EVENTS-100 at NZD 19 / 100 events as a later primary offer candidate, not the first path until the probe settles and fulfills correctly.
3. QUOTE-COMPARE-49 must not be silently represented as a free automated paid deliverable. Free intake / worksheet can be offered only to the extent the live path actually provides it; paid comparison fulfillment remains quarantined until verified.
4. Do not mint new SKUs or use x402/EIP-3009 as if it were already an operational settlement path. Stripe is the existing payment rail for this proof.

## Today’s execution order
### P0 — Recover and verify existing gateway
- Capture current status and response headers for the canonical custom-domain manifest, Render manifest, checkout, probe, health and version endpoints.
- Compare deployed commit, service configuration, route registration, required environment variables, checkout handler, Stripe price/SKU mapping and canonical webhook.
- Repair the smallest cause of 503; no parallel service or duplicate route.
- Add deterministic smoke tests for both domains and for the actual compiled production artifact.
- If Supabase remains unavailable, mark DB durability, atomic quotas and persistent order writes UNVERIFIED. Do not apply migrations or claim a database-backed pass.

### P0 — Prove purchase to delivery
Required chain: independent buyer → explicit authorization → exact SKU/amount/currency settlement → idempotent entitlement → scoped key → authenticated successful probe / bounded value → attributable receipt → reconciliation.
- Reject unpaid, wrong amount/currency/SKU, replayed, refunded, expired or mismatched events.
- Ensure duplicate webhook deliveries do not duplicate entitlement or fulfillment.
- Never use a self-purchase or test event as market validation.
- Capture provider settlement evidence, delivery result, receipt ID, source/referral attribution and net proceeds after fees/refunds.
- Only mark revenue VERIFIED when independent evidence reconciles across settlement and fulfillment.

### P1 — Canonical doorway, after P0 works
- Reuse https://dreamledger.org/go as the one canonical human / machine doorway.
- Keep ref and c identifiers strictly validated; do not interpolate raw query values into HTML or executable JavaScript.
- Attribution telemetry must be best-effort and must not block the doorway. Do not create a new Supabase table until database persistence is verified; reuse an existing healthy telemetry path if one exists.
- Human visitors see truthful free utility and a clear paid offer. Machine clients can request the existing machine-readable manifest. User-Agent strings are hints, not authorization.
- Generate campaign-specific QR codes that all resolve to the canonical doorway; no mass distribution until the checkout and fulfillment path passes.

### P1 — Low-cost distribution experiment
After live checkout and delivery proof, prepare a zero-upfront, permission-respecting campaign. Start with a small set of high-intent developer/API surfaces and partner placements; no spam, scraped contact lists, paid placement or public posting without the relevant approval. Use distinct campaign IDs and measure:
impressions → scans/visits → qualified intent → checkout starts → settled independent buyers → fulfilled calls → repeat use → contribution margin.
Scans, bots, checkout starts and model-generated interest are not buyers.

### P2 — 777 compounding / local BEC machine
- Run one bounded cycle through the existing 777, CUBE, Elohim, Gauntlet and BECK lineage. Read existing playbook/protocol first; do not build another scheduler or ledger.
- Every cycle must produce either (a) verified economic outcome evidence or (b) a durable, falsifiable failure artifact with exact response, commit, test output, owner/next action and stop condition.
- The missing import os in scripts/777_compounding_gate.py was confirmed and corrected in commit 24e456b56286f0e015e387fecdc5e39a84051c6f. A static regression test was added in commit 198e8bff39d7cb2a7839d3f216f6d796d8c41729 and wired into the workflow in commit 37ef7a7f2668c07f79d57849c0f4aa184a0c7dc4. CI/deploy results still require observation. A read-only local verifier is at scripts/VERIFY-FIRST-MONEY.ps1.
- Local LM Studio is an accelerator, not an authority. PC-offline must not be described as a running local worker. Any real charge, public transmission, disclosure or irreversible action stays behind the existing human approval gate.

## Roles and acceptance
- Scout / CUBE: identify the earliest missing transition, not more ideas.
- Elohim: rank bounded repairs and candidate demand evidence.
- Gauntlet: hard-fail UNKNOWN, missing evidence, mismatched price/SKU, replay or fulfillment gaps.
- BECK / Figure Eight: preserve lineage and request human approval only for consequential boundaries.
- Truth Oracle: separate VERIFIED, OBSERVED, INFERRED, PROPOSED, STALE, CONTRADICTED and TEST.
- Human attention: one decision at a time; no recurring manual reconciliation if an idempotent verified connector write can do it safely.

## End-of-day exit criteria
- At minimum: fresh cross-domain smoke evidence, root cause or exact unresolved blocker for the 503, regression test, updated repository artifact, and reconciled Notion/Airtable state.
- Stretch target: one independent buyer settles and receives the promised probe result today.
- If no buyer converts, report the exact funnel evidence and next smallest action. Never label ambition as a forecast.
- Verified external revenue remains NZD 0.00 until the full chain is independently evidenced.


## Live findings and repair commits — 2026-10-11
A fresh read-only fetch at approximately 2026-10-11 16:52 NZ time observed:
- https://dreamledger.org/go returned HTTP 404.
- https://dreamledger.org/api/toll/v1/manifest returned HTTP 503.
- https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest and /api/toll/v1/checkout/toll-probe returned HTTP 503.
- https://dreamledger.org/.well-known/agent-commerce.json returned HTTP 200 but advertised current_offers as empty, first_payment_proof NOT_PROVEN, and revenue_nzd 0.
- The Render service inventory does not include the dreamledger-engine private service referenced by render.yaml. public/server.js previously proxied all toll endpoints to ENGINE_INTERNAL_URL, explaining a missing dependency risk. No new paid service will be provisioned.

Changes now committed; deployment and live behavior are not yet verified:
- 24e456b56286f0e015e387fecdc5e39a84051c6f: import os in the 777 compounding gate.
- 198e8bff39d7cb2a7839d3f216f6d796d8c41729: regression test for the gate's current-run environment binding.
- 37ef7a7f2668c07f79d57849c0f4aa184a0c7dc4: run that regression test in 777-cycle workflow.
- 3c7ae68a0309be5787fe0e163945aca3cc4c355e / 2cf242f62a1f51de3e9f0be048bdaa35d3a3f96a: add a canonical campaign-aware /go page to public/go and repository-root go/index.html. ref/c values are validated before storage and propagated only to same-origin links; no new database writes are required.
- e3f7ac1574ae9a8fb587bbffabcd342636ef59f8: map the storefront's /go route to the canonical doorway.
- cb63de14fee552f5641388b3d84ba965b2b56cba: route only the TOLL-PROBE-50C and AGENT-BRIDGE-EVENTS-100 scopes through the existing BEC-PRIME toll handler in the current storefront process; publish a two-offer manifest with explicit unverified/configuration status. Other toll scopes remain unpublished. This removes the hard dependency on a separately provisioned service, but Stripe and toll-key secrets may still be missing; live checkout must prove otherwise.

Current state after commits: deployments were queued/in progress at last inspection. Do not call /go or toll paths fixed until fresh HTTP checks return the expected responses. The 50-cent checkout still must pass settlement → entitlement → authenticated probe → receipt before QR distribution.


## Final live verification — 2026-10-11
Latest storefront deployment is live on commit c031e7e672518b5d4b784448b7a885a6c7c6ec4a. The production prestart now runs `npm test` before compilation; the two-test suite passed and the deployment completed.
- `https://dreamledger.org/go/?ref=qr&c=universal-20261011` returns the canonical doorway.
- `https://dreamledger.org/api/toll/v1/manifest?ref=qr&c=universal-20261011` returns HTTP 200 and propagates `ref=qr` / `c=universal-20261011` into the NZ$0.50 checkout route.
- Manifest truth remains `CONFIGURED_NOT_END_TO_END_VERIFIED`, `first_payment_proof=NOT_PROVEN`, and `revenue_nzd=0`.
- The NZ$19 Agent Bridge Events pack has no checkout URL in the manifest and its checkout route returns HTTP 404 until the 50-cent probe is proven.
- A prior direct Render-host GET returned HTTP 303 to Stripe, proving only that a checkout session can be created. We deliberately did not repeat the request because GET creates an unpaid Stripe Checkout Session.
- The probe handler now verifies a live paid NZD 0.50 Stripe session, writes a durable `probe_consumed` marker to Stripe metadata, and returns the same receipt on retries/restarts. The mocked regression test covers campaign metadata plus retry behavior. No live paid probe has exercised this code yet.
- `scripts/VERIFY-FIRST-MONEY.ps1` is read-only and no longer calls the checkout endpoint, avoiding extra unpaid sessions.
- The local QR PNG/SVG encode `https://dreamledger.org/go/?ref=qr&c=universal-20261011` and decode correctly. They remain undistributed until a real payment settles, the probe is fulfilled, and the attributed receipt is reconciled.

Verified external revenue remains NZD 0.00. No independent buyer, paid fulfillment, or verified economic outcome has been observed. The 777 pulse candidate remains research-only after Gauntlet FAIL; it is not demand evidence. Supabase-backed ProductionBridgeWorker still reports a 503 on its bridge-auth store, so no Supabase schema change was made.
