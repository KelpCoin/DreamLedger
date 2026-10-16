# Persistence, Recovery, and Monetization Evidence Protocol

**Status:** Draft implementation record. This file is on the Figure Eight feature branch and is not production policy until reviewed and merged. It does not authorize deployment, spending, checkout activation, secret changes, or public launch.

## 1. Non-negotiable work lifecycle

### Start
1. Read the existing Airtable canonical control record and the Notion DreamLedger 777 Commercial North Star page.
2. Read current GitHub PR/branch/check status, relevant health endpoints, and current economic evidence. Use timestamps and commit SHAs; treat old observations as stale until refreshed.
3. State the current HOLD/PROCEED decision, exact objective, boundaries, and the prior checkpoint being resumed. Never rebuild from chat memory alone.

### During work
4. After every material change, probe, test, or decision, capture the source URL or run ID, timestamp, commit/deployment SHA where available, expected vs observed result, and limitations.
5. Keep evidence artifacts in the repository or a durable connected workspace. A sandbox file is a convenience copy, never the sole copy. Use stable names, SHA-256 manifests, redacted contents, and cross-links.
6. Label each claim DONE, TESTED, VERIFIED, BLOCKED, or UNVERIFIED. Separate branch evidence from deployed behavior; unit tests from live acceptance; payment creation from settlement; and settlement from fulfillment/delivery.

### Closeout
7. Before ending a material work session, update the existing Airtable canonical record and Notion North Star page with: status; exact evidence links and hashes; what changed; what did not change; unresolved blockers; the next best action; and the current economic truth.
8. Read back both records. A successful write response is not enough. Also read back the GitHub path/commit when a repository artifact was written. Confirm that the content and links actually exist.
9. Report the persistence result explicitly: all destinations verified, partial persistence with named failures, or UNPERSISTED. Never imply the work is safely saved when verification failed.

## 2. Recovery order when a service fails

- **GitHub unavailable:** write a timestamped local JSON/Markdown proof pack plus SHA-256 hash; write the checkpoint to Airtable and Notion; label repository sync BLOCKED and do not treat the local copy as durable until synced.
- **Airtable unavailable:** commit the sanitized artifact to the current feature branch or create a tracked issue; update and read back Notion; mark Airtable sync BLOCKED.
- **Notion unavailable:** commit the sanitized artifact to GitHub and update/read back Airtable; mark Notion sync BLOCKED.
- **One store rejects a write or read-back mismatches:** keep the verified copies, record the exact failed destination and error, and leave a repair item. Do not silently retry destructive edits or overwrite unrelated content.
- **All durable stores unavailable:** return the complete checkpoint in the response and a downloadable proof file, clearly label it UNPERSISTED, and do not close the task as complete. Retry during the next authorized run.

No secrets, customer personal data, payment credentials, or unnecessary sensitive logs belong in shared proof artifacts.

## 3. Economic truth and change gates

Verified revenue remains NZ$0.00 until the evidence joins: independent external buyer; settled payment; correct buyer/order/SKU attribution; fulfillment; delivery confirmation; independent evidence; and reconciliation including reversal/duplicate checks. A green build, a checkout URL, a Stripe session or PaymentIntent, an internal row, or an agent-generated report is not revenue.

Keep public checkout and payment routes held unless the canonical offer, exact live price/SKU mapping, settlement webhook, durable idempotency, entitlement/quota accounting, fulfillment, delivery receipt and reconciliation all pass. No live secret mutation, webhook activation/deactivation, checkout activation, purchase, payout/refund, spending, deployment, merge, or public promotion without the applicable explicit approval. Unknown state fails closed.

## 4. Portfolio-wide monetization, not a one-product tunnel

Elohim may generate and refine many candidates across silos. The Gauntlet must reject unsupported, duplicated, unpriced, unfulfillable, legally unclear, or unprovable candidates. Fix shared substrate blockers once and reuse the repaired path across qualified products. Rank the whole portfolio by evidence, customer utility, no-upfront-cost acquisition, delivery cost and expected contribution, but do not falsely narrow strategy to one SKU. Never create fabricated inventory, Stripe links, buyers, demand or economic proof. Scale catalog production only when the shared checkout-to-delivery path is safe.

## 5. Resilience requirements

- Maintain a canonical evidence index with immutable source URLs/SHAs, timestamps, hashes, verdicts and limitations.
- Keep two independently readable copies of critical checkpoints in GitHub plus Airtable/Notion; local proof is a third recovery copy when available.
- Use durable Stripe event-ID deduplication in the same database transaction as side effects; make entitlement creation and quota redemption idempotent and concurrency-safe; record retries and dead-letter failures.
- Monitor live health, webhook delivery, checkout-route redirects, deployment SHA and fulfillment backlog. Distinguish “monitor ran” from “failure found and repaired.” Avoid alerts during the user's 02:00–08:00 New Zealand quiet window.
- Maintain a provider fallback plan for hosting and database outage, with a documented restore/export path. Failover is not automatic unless rehearsed, verified, and authorized.
- Keep local BECK optional. Cloud execution and authoritative records must still function with the PC off.

## 6. Current known blockers at checkpoint (2026-10-16)

- PR #742 is draft/open/unmerged and not deployed.
- Latest PR evidence reports live /billboard.html still exposing five direct Stripe links and /buy/COMMANDER-DECK-DIAGNOSTIC-001 still redirecting to Stripe; branch tests now fail closed on these routes, but a fresh authorized deploy and independent live probe are required before declaring them repaired.
- Latest recorded scheduled production heartbeat reported empty SUPABASE_URL and HTTP 0 for /healthz and /version.
- The diagnostic delivery runtime last returned HTTP 503 STRIPE_CONFIG_MISSING.
- Webhook paths are inconsistent: v2 targets quarantine, v4 and legacy Render endpoints are enabled, canonical v5 stripe-revenue is disabled, and a separate Billboard endpoint is enabled. Historical provider links may remain live. Do not infer that compiled offers held in source are disabled at Stripe.
- The end-to-end paid-event to durable dedupe to attributed order to atomic quota/entitlement to fulfillment to delivery receipt to reconciliation chain has not been demonstrated.
- Fresh PR-triggered check set associated with protocol commit af65b7cb45129fe82e1badcbb68ba5fd00209eac: 51 runs observed, 38 pass, 12 fail, 1 in progress at the snapshot. Failing runs: Cortex CI/CD Live Release Gate (#38881262429), Cloud Elohim Website Gauntlet (#38881262394), DreamLedger E-Commerce Smoke (#38881262974), production-check (#38881262741), DreamMeez Public Surface Gate (#38881262884), economic-revenue-gate (#38881262447), Compiler Pong Proof (#38881262246), DreamMeez Paid Entitlement (#38881262364), Bootstrap Gauntlet (#38881262752), Forensic BEC Compiler Run (#38881262904), Universal Compiler (#38881262724), and BECK Economic Gauntlet (#38881262785). Economic Autonomy Staged CI (#38881262968) was still in progress. These checks are associated with the PR merge commit and do not prove the documentation change caused the failures.
- The latest economic Gauntlet logs confirm /billboard.html returned five direct Stripe checkout links and /buy/COMMANDER-DECK-DIAGNOSTIC-001 redirected to Stripe; the probe marks those held surfaces BLOCKED. It also reports a Supabase REST probe returning HTTP 401, so authenticated database/RPC health remains unverified, and end-to-end paid-order-to-delivery proof has not been performed. The storefront smoke gate fails because the homepage lacks receipt-backed commerce positioning. ACNC continuity and approved-offer gates also fail because tests still expect checkout enabled/VERIFIED_AVAILABLE while the canonical doctrine is holding offers. Resolve these as contract inconsistencies; do not make held offers live simply to turn tests green.
- Workflow logs show the local production-bridge worker was NOT_CONFIGURED in the smoke job because SUPABASE_URL, DREAMLEDGER_AGENT_BRIDGE_TOKEN and AGENT_BRIDGE_PROXY_URL were missing in that test environment. Separately, the last recorded production heartbeat reported SUPABASE_URL empty and /healthz and /version HTTP 0. Keep these as distinct environment observations until production configuration is read back.
- Verified external revenue: NZ$0.00; independent buyers: 0; settled external payments: 0; paid fulfilled orders: 0.

## 7. Acceptance for the protocol itself

A work session is closed only when (a) evidence is captured, (b) a durable artifact or tracked task exists, (c) Airtable and Notion are updated and read back, (d) source SHAs and unresolved conditions are stated, (e) the user receives a concise truthful closeout, and (f) the next action is explicit. The daily automation is configured to repeat the closeout steps without bypassing human approval gates, but its scheduler returned next_run_time=null after a schedule update on 2026-10-16. Treat the next scheduled execution as UNVERIFIED until an actual run is observed. The automation is reinforcement, not a hard guarantee; every interactive work session must still obey the closeout rule. Its intended local schedule is daily at 21:00 Pacific/Auckland.
