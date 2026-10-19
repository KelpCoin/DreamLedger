# 777 Expedition: Agent Bridge Economics Gate v1

Date: 2026-10-20
Status: HOLD / UNVERIFIED
Expedition ID: DL-777-AGENT-BRIDGE-ECONOMICS-20261020

## Purpose

Refine the existing Agent Bridge into cheap, bounded A2A execution that can be monetized without charging for failed work, duplicating ledgers, minting SKUs, or counting technical activity as revenue. Free B2B discovery remains the acquisition layer.

## What the existing substrate already provides

The repository already has the canonical Agent Bridge protocol, 500-route Money Playbook, versioned toll-road JSON Schema, bounded long-task schema, and 777 first-dollar work contract. The toll schema already specifies scoped authorization, budget ceiling, expiry, idempotency, quota, hard timeout, usage receipt, estimated cost, and a minimum margin field. Reuse these; do not create another ledger or execution architecture.

Airtable already holds Agent Bridge route repair, toll metering, first-dollar settlement-to-delivery proof, route parity, task contract, and free B2B lifecycle items. The Notion 777 Marketplace Expedition already establishes free B2B discovery, cheap metered A2A, bounded/idempotent work, and the independent-settlement-plus-fulfilment evidence standard.

## Existing offer ladder, not new products

- TOLL-PROBE-50C: recorded NZD 0.50 for one bounded probe. It remains held or unverified. Its job is first external end-to-end proof, not a claim of profitable unit economics.
- AGENT-BRIDGE-EVENTS-100: recorded NZD 19.00 per 100 events, arithmetically NZD 0.19 gross per included unique event before applicable tax, processing fees, costs, support, refunds and disputes. It remains a candidate held until the probe and measured unit economics pass.

The amounts are found in existing project records. They are not proof that the current route, link, settlement or fulfilment path is working. No new offer, price, or payment object should be created to route around a blocked existing path.

## Monetization design

1. Free B2B discovery: browsing, supplier/capability discovery, and RFQ intake remain free by default. Add rate limits, provenance, seller controls, freshness, moderation and removal/appeal controls.
2. Cheap A2A: bill one unique accepted successful receipt, not each HTTP retry. Enforce scope, budget ceiling, expiry, tool allowlist, hard timeout, quota and idempotency server-side.
3. Retry semantics: same key plus same payload returns the original receipt without a second bill or quota decrement. Same key plus different content is rejected. Unauthorized, malformed, over-budget and failed work must not be represented as successful delivery.
4. Unit economics: calculate contribution after applicable tax, refunds/disputes, processing fees, provider/compute, storage/delivery and attributable support. Current measured cost and margin are unknown. Unknown must not become zero. Configure a minimum-margin floor from measured costs before activation.
5. First-dollar path: route parity, exact offer/price/SKU mapping, scoped authorization, durable atomic quota/idempotency, signed settled payment, entitlement, bounded execution, retrievable delivery receipt, and ledger reconciliation. Test-mode proof is separate from actual external revenue.

## Current evidence state

- Verified external revenue: NZD 0.00.
- Independently verified external buyers: 0.
- Verified settled attributable external payments: 0.
- Verified paid fulfilled orders: 0.
- Live gateway/route and database-backed quota/receipt durability were not newly verified in this expedition.
- Last recorded infrastructure checks said Render build-pipeline minutes were exhausted and Supabase SQL access returned connection errors. A fresh read-only probe is required before treating those components as healthy.
- The public research fetcher could not retrieve the relevant live API routes. That tool limitation does not establish whether the routes are currently up or down.

## Next execution sequence

1. Read the live custom-domain and gateway state without creating a checkout session.
2. Read back the canonical toll manifest, deployed route, exact provider price/link mapping, and webhook ownership. Keep the current hold if any mapping is missing.
3. Restore read-only data-plane observability before any database-dependent write or migration.
4. Run deterministic test-mode authorization, budget, quota, idempotency, signed-event, replay, concurrency, failure/retry, receipt, and reconciliation fixtures.
5. Measure real variable cost and configure an evidence-based minimum contribution margin.
6. Only after the prior gates pass and a human explicitly approves the action, permit one independent-buyer path; reconcile real settlement and delivered value before changing economic truth.

## Approval boundary

This artifact did not enable checkout, create Stripe objects or sessions, change secrets, mutate production data, trigger a deployment, publish a public post, contact a buyer, or spend money. Existing approval gates remain binding.

## Machine contract

See the adjacent machine-readable acceptance contract:
docs/777/agent-bridge-economics-gate-2026-10-20.json
