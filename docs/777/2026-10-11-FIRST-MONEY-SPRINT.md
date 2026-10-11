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
