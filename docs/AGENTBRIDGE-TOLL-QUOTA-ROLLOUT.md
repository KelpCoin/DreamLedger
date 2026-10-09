# Agent Bridge toll-road MVP and rollout gates

## Commercial ladder

- Free: public offer catalogue, Agent Bridge manifest, and machine-readable commerce contracts.
- NZ$1: one paid toll probe, once durable metering health passes.
- NZ$2: 200 structured Agent Bridge events.
- NZ$5: 500 structured Agent Bridge events.
- NZ$9: 100 evidence classifications.
- NZ$9: shared access pass for 5,000 billable calls across explicitly published routes, valid 30 days, one-time prepaid.
- NZ$19: 100 bounded decision evaluations.
- NZ$19: 25 Toll Nexus runs composing Truth, Gauntlet and Agent Bridge coordination.
- Higher-value routes remain conditional on their route implementation and are not sold just because they appear in the 200,000-road design target.

These prices are proposals until the deployed Toll Road manifest reports readiness and the purchase-to-delivery path passes live tests. Do not infer that a checkout link is usable merely because it exists in source.

## Canonical commerce and fulfillment

Each checkout carries a canonical `sku_id` and matching price metadata. The migration registers the toll SKUs in the existing `skus` and `revenue_catalog` tables. The existing Stripe revenue webhook remains responsible for recording `revenue_orders`, `revenue_entitlements`, `fulfillment_requests`, `economic_events`, and reconciliation.

Redemption does not issue a key from Stripe's browser redirect alone. It requires a matching paid canonical order, entitlement, and fulfillment request. Checkout remains disabled unless `DREAMLEDGER_TOLL_CANONICAL_WEBHOOK_READY=true` is set after the live Stripe endpoint is verified to feed the existing revenue webhook. That flag must not be set merely because the Edge Function exists. The signed API key is deterministic for the Checkout Session. Issuance records the key digest and marks fulfillment `FULFILLED_UNVERIFIED`; the first successful authenticated API response upgrades the existing fulfillment and reconciliation records to `FULFILLED_VERIFIED`. The bearer key itself is never stored in the event log.

## One existing substrate, no new ledger

Payment stays in Stripe. The signed key is deterministically derived from the settled Checkout Session identity and is not a new payment fact. Usage reservation and result receipts use the existing `control_bridge_notes` structured-event substrate via Agent Bridge RPC. No new ledger table or queue is introduced.

## Request lifecycle

1. Checkout creation requires the live `agent_toll_meter_health` RPC to return `ready=true`.
2. Redemption verifies live-mode Checkout Session, `payment_status=paid`, NZD currency, the full session amount, and the server-written price metadata.
3. The signed key is deterministic for that Checkout Session, with a fixed 30-day expiry.
4. Every published paid POST requires `Idempotency-Key`.
5. Before work, the Toll Road calls `reserve_agent_toll_call`. The RPC takes a per-key advisory lock, rejects key reuse with a different request digest, returns the stored result for a completed identical retry, and blocks the call when the allowance is exhausted.
6. The operation runs only after reservation. `complete_agent_toll_call` stores its status and response in the same bridge event record.
7. If the RPC or proxy is unavailable, checkout, redemption, and paid work fail closed.
8. Customer event ingestion forwards only bounded discovery/evidence/evaluation events into the existing `/api/agent-bridge/events` route. Customer API keys cannot assert `PAYMENT_DETECTED`, fulfillment, approval, or verified revenue.

## Published scopes

Only the routes explicitly listed in `BEC-PRIME/runtime/TollRoad.js` as published may be sold. The shared route pass is restricted to those same routes. Placeholder routes may remain in the internal design manifest but must have `checkout_configured=false` and must not be included in customer-facing claims.

## Mandatory acceptance tests

- Missing/malformed/revoked key rejected.
- Missing `Idempotency-Key` rejected before reservation.
- Same key + same request replays the saved response without a second execution.
- Same key + changed route/body rejected.
- Parallel requests cannot exceed the allowance.
- A 500-call pack permits 500 distinct accepted operations and blocks the 501st before route execution.
- Duplicate Checkout redemption yields the same signed key, not a fresh allowance.
- A not-ready health RPC disables the public buttons and blocks checkout creation and redemption.
- Event ingestion writes through Agent Bridge, returns an event receipt, and refuses customer-authored payment/fulfillment/revenue event types.
- The shared route pass expires after 30 days and its 5,000-call allowance is shared across supported routes.
- A real buyer's settled payment, entitlement, API result, and delivery evidence are reconciled before verified external revenue changes.

## Current truth boundary

The live public Agent Bridge manifest is configured, but the previous live Toll Road manifest incorrectly advertised checkout as armed based on environment configuration alone. This change makes readiness depend on the durable meter health RPC and marks placeholder products unavailable.

The migration is not applied until Supabase is healthy. The code and offline tests are not a substitute for live RPC, concurrency, and end-to-end Stripe acceptance. Until those gates pass, the new offers remain proposed and the verified external revenue scoreboard remains NZ$0.00.
