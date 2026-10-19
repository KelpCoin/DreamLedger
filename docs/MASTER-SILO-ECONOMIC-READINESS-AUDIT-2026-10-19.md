# DreamLedger economic and master-silo readiness audit

**Date:** 19 October 2026  
**Scope:** Repository source, connected Supabase function metadata/source, available commercial evidence, and clone-readiness controls.  
**Status:** FAIL / HOLD for production certification. This is not a penetration test or legal audit.

## Executive verdict

DreamLedger is not yet economically validated or certifiably enterprise-grade. The current evidence baseline remains NZ$0.00 verified revenue, zero independently verified buyers, zero fulfilled orders, and zero complete delivery-evidence records. System activity, checkout creation, Stripe observations, test records, and generated catalogues do not substitute for independent settled-and-fulfilled commerce.

The MTG silo has a useful foundation: a dedicated catalog compiler, a published-deck API, a fee-policy test asserting MTG at 0 basis points, and silo-boundary/agentic-commerce verification scripts. Those are useful controls, not proof of end-to-end commercial operation. There is not yet evidence here that a paid MTG order moves atomically through settlement, identity attribution, inventory reservation, fulfillment, customer delivery, and independently retrievable proof. Do not clone or upscale the commercial template as production-ready until those gates pass.

## Findings from inspected source

### Critical: paid ownership can be self-granted

Migration `20260822_dreammeez_cross_game_items.sql` creates `commerce_item_ownership_self_insert` for authenticated users. When the row represents a paid or earned entitlement, that permits a browser client to insert its own ownership row. The hardening migration proposed alongside this report removes all table mutation policies and revokes direct write privileges from browser-facing roles. The trusted fulfillment path still needs a verified, idempotent server-side grant function.

### High: MTG catalog-sync deployment is not represented at its expected repository path

The deployed `mtg-catalog-sync` Edge Function is active with JWT verification enabled, but `supabase/functions/mtg-catalog-sync/index.ts` is absent from the inspected `main` branch. Its deployed body checks only that an Authorization header is present before it uses the service-role client to write catalog rows and price observations. Gateway JWT validation does not make every authenticated user an authorized catalog administrator. This is both an authorization defect and a source/deployment drift problem. Do not redeploy a replacement until its admin identity, FX data source, and database schema have been reviewed.

The same deployed body assigns `prices.usd_foil` to `price_nzd` when a foil USD price exists. That is not a currency conversion. A catalogue field labelled NZD must not silently contain USD values.

### High: publication defaults open in the MTG deck API

The repository version of `supabase/functions/mtg-deck-catalog/index.ts` sets `publish = body.publish !== false`. Any successfully authenticated caller can therefore request immediate publication, without this function proving an authorized moderator decision. The proposed branch forces newly submitted decks to draft and returns a human-review hold. This is a conservative gate, not a replacement for a real, audited moderation/approval endpoint.

### High: webhook observation is not delivery or revenue proof

The inspected active `dreamledger-stripe-webhook-v3` records Stripe observations and reconciles CUBE telemetry. It writes an economic state of `PAYMENT_SETTLED` when a Checkout Session is live and says `payment_status = paid`, but the function itself does not perform MTG fulfillment or DreamMeez entitlement delivery. It also checks for a prior event, performs downstream writes, and records the event receipt at the end; the sequence is not a single database transaction. An event-level unique constraint may prevent duplicates, but cannot make these multiple API writes atomic. Raw event payload persistence also requires explicit PII access and retention controls.

Keep the economic ledger conservative: payment confirmation alone is not a fulfilled, delivered, evidence-complete sale.

### High: live database verification is blocked

Supabase project metadata reports the primary project as active, while SQL table inspection and migration listing fail with a PostgreSQL connection refusal to the project's IPv6 endpoint. The current database policies, grants, constraints, migration drift, indexes, event uniqueness, and row counts cannot be independently verified through the available SQL tool. Therefore, proposed SQL has not been applied and no live security claim is made.

### Medium: MTG catalog compilation is not a commercial end-to-end test

`MTGCatalogCompiler.js` copies the MTG HTML and assets and writes a compilation hash/proof. The fee policy script asserts `dreamledger-mtg = 0 bps`. These checks validate specific local contracts only. They do not verify a real checkout URL against Stripe, paid-event signature handling, sold-inventory decrement, duplicate-event safety, buyer identity binding, delivery receipt persistence, refund/chargeback reconciliation, or clone isolation.

### High: DreamMeez catalog and checkout are not the same catalog

The inspected `dreammeez-cosmetic-checkout` function exposes six legacy cosmetic IDs, uses the legacy `cosmetic_sales` ownership lookup, and creates a Stripe Checkout Session. The 18-item First Light catalogue and three sets are not represented in that function's SKU allowlist. Checkout creation therefore does not prove First Light has been wired into payment, inventory entitlement, equip persistence, or delivery evidence.

## Changes proposed on this branch

1. A database migration removes authenticated mutation policies and direct write grants for `commerce_item_ownership`.
2. A database-level SQL assertion checks RLS, mutation policies, browser-role grants, and the self-read policy.
3. The MTG deck API now holds submissions in draft until an authorized human-review path exists.
4. A static guardrail verifier and package script check the repository-level controls.

These are proposed changes on a review branch only. The migration has **not** been applied to production, the Edge Function has **not** been deployed, and the static/database tests have not been executed against a live database.

## Clone/upscale acceptance gates

MTG is clone-ready only when every gate below has machine-readable evidence and a named owner:

1. **Canonical silo manifest:** every clone gets its own `silo_id`, catalog namespace, pricing/fee policy, allowed product kinds, fulfillment handler, and permitted public routes. No copied secrets, inventory, Stripe price IDs, or customer rows.
2. **Checkout integrity:** server-owned SKU/price/currency allowlist; authenticated buyer identity; quantity/inventory validation; explicit test/live separation; correct silo and attribution metadata.
3. **Settlement:** signed Stripe webhook; `livemode=true`; paid status; exact amount/currency/SKU/session mapping; duplicate and out-of-order event handling; unique event/session constraints; transactional ledger update or recoverable outbox.
4. **Fulfillment and proof:** inventory/entitlement granted once only after payment verification; durable delivery receipt; delivery artifact retrievable by order ID; retries idempotent; compensation/reconciliation path for partial failure, refunds and disputes.
5. **Security:** RLS/grants verified from the live database; no client entitlement writes; privileged functions require trusted authorization; seller/moderator approval is separate from login; secrets are not in browser bundles or generated silo manifests.
6. **Operational readiness:** migrations reconcile; automated tests and CI pass; errors/lag are observable; alerts have owners; backup restore and rollback are tested; rate limits and data-retention rules are explicit.
7. **Economics:** at least one independent paying customer completes the whole chain; contribution margin includes payment fees, fulfillment labour, refunds and support; acquisition source and conversion are measured. Repeatability needs more than a single sale.
8. **Clone proof:** at least one second silo is generated from the same universal template and passes the same acceptance suite without MTG-specific code or cross-silo data/credential leakage.

## Next blocking sequence

1. Restore read-only database inspection and verify the migration history, ownership policies/grants, checkout tables, webhook uniqueness constraints, and actual MTG order/fulfillment schema.
2. Merge and apply the ownership hardening only after schema/policy diff review in a controlled database window.
3. Put the deployed catalog-sync source under version control, enforce an explicit administrator authorization, fix price-unit handling, and reconcile the deployed version with the source commit.
4. Close the MTG paid order to delivered-proof path with tests for invalid signature, unpaid session, test-mode payment, wrong amount/currency/SKU/silo, duplicate event, parallel webhook, inventory race, delivery failure/retry, refund, and chargeback.
5. Run the same suite against a second isolated silo. Only then consider the template clone-ready.

**Commercial status remains HOLD. Verified revenue remains NZ$0.00.**
