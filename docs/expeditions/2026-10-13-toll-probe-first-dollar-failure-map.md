# TOLL-PROBE-50C first-dollar failure map

**Observed:** 2026-10-13  
**Scope:** read-only production-path audit and bounded repair contract  
**Truth state:** `BLOCKED` / `UNKNOWN_QUARANTINE`  
**Verified external revenue:** NZ$0.00  
**Spending/deployment authorization:** none  
**Source branch:** `expedition/2026-10-13-toll-probe-failure-map`

## Decision

Do not promote, distribute, or enable TOLL-PROBE-50C. The current checkout entrypoint, existing Stripe link metadata, settlement handler, and production data plane do not form a proven end-to-end contract. Database recovery alone is insufficient.

This document is an acceptance map, not proof that repairs are deployed. It must not be interpreted as a live offer or a payment instruction.

## Evidence snapshot

The 2026-10-13 read-only audit reported:

- Public toll manifest: [`/api/toll/v1/manifest`](https://dreamledger.org/api/toll/v1/manifest) reports `HELD_NOT_END_TO_END_VERIFIED`, `checkout_enabled=false`, `first_payment_proof=NOT_PROVEN`, `entitlement_redemption=NOT_PROVEN`, and null price/checkout/execution routes.
- Canonical checkout dispatch in the last-known deployed source returns HTTP 503 before the existing toll handler is reached. The audit deliberately did not request the checkout URL because GET behavior could create an unpaid Checkout Session if implementation changes.
- Existing live Stripe Payment Link `plink_1UNpw7EGgEAnUFF9yLItVlyv` was reported active at NZ$0.50, but all 15 associated sessions were expired/unpaid, had no PaymentIntent, omitted `toll_scope` and `toll_request_id`, and returned to a generic Stripe destination.
- The existing redemption contract requires a paid live session, exact NZD 0.50 amount, and `toll_scope=toll-probe`. The direct link as configured cannot satisfy that contract.
- Inspected settlement source supports `COMMANDER-DECK-DIAGNOSTIC-001`, not TOLL-PROBE-50C. Its database pre-read plus separate writes are not a transactional inbox.
- Production webhook parity and successful delivery of a TOLL event were not verified.
- Supabase read-only `SELECT 1` timed out while the control plane reported `ACTIVE_HEALTHY`. No writes, migrations, or destructive recovery were attempted.
- The latest 100 Stripe events inspected in the audit contained 70 `checkout.session.expired` events and no completed Checkout Session, succeeded PaymentIntent, or succeeded Charge. This is bounded recent evidence, not an all-time negative proof.
- Two succeeded PaymentIntents (NZ$5 and US$1) had empty metadata and remain unmatched/unverified, excluded from DreamLedger revenue.
- PR [#686](https://github.com/KelpCoin/DreamLedger/pull/686) contains fail-closed checkout configuration changes but was not deployed in the audit. PR [#687](https://github.com/KelpCoin/DreamLedger/pull/687) addresses production `/version` parity and remains a separate gate. Render build capacity was reported exhausted; no spend or upgrade is authorized.

## Bounded task graph

### TOLL-01: Route identity and dispatch
**Gate:** source and deployed handler identity agree; canonical route reaches the intended handler; disabled mode fails closed before any Stripe API call.

Proof required: exact source commit, route test, and production commit/route parity. A health endpoint alone is insufficient.

### TOLL-02: Checkout contract
**Gate:** server-created Checkout Session binds the existing SKU, exact amount/currency, `toll_scope=toll-probe`, a unique `toll_request_id`, and a non-generic success destination.

Proof required: automated test-mode session inspection with no live purchase and no secrets in logs. Do not reactivate or promote the existing misbound direct Payment Link as a workaround.

### TOLL-03: Settlement inbox and attribution
**Gate:** signed Stripe webhook accepts the TOLL SKU and verifies event, live mode, currency, amount, request scope, and attribution. Duplicate and concurrent deliveries are idempotent.

Proof required: replay, duplicate, out-of-order, wrong-SKU, wrong-scope, wrong-amount, and invalid-signature tests. Durable uniqueness must be enforced transactionally, not by a pre-read followed by independent writes.

### TOLL-04: Entitlement, quota, and bounded execution
**Gate:** only a settled, attributed order can issue a scoped entitlement; quota is atomic, capped, expiring, and replay-safe; execution cannot exceed the purchased scope.

Proof required: negative tests for missing/expired/revoked entitlement, repeated request, quota exhaustion, and cross-scope access.

### TOLL-05: Delivery and reconciliation
**Gate:** successful execution returns a stable receipt linked to buyer/order/session/event; reconciliation can join payment → order → entitlement → execution → receipt and handle refund/dispute state.

Proof required: a complete test-mode trace and independent read-back. Production proof still requires a genuinely independent buyer and settled payment, not a simulated record.

### TOLL-06: Production release authority
**Gate:** Supabase data plane is readable, required secrets are configured through authorized settings without disclosure, live service identity is known, required Gauntlet/Authority passes exist, and deployment capacity is available without unapproved spend.

Proof required: explicit operator approval for any live-link status change, secret/config mutation, production write, deployment, or spend.

## Stop conditions

Keep checkout disabled and distribution paused if any gate is unknown, database access fails, production commit parity is stale, webhook attribution is incomplete, entitlement is not idempotent, or delivery evidence is absent. Do not test by buying the product.

## Revenue truth

`VERIFIED_EXTERNAL_REVENUE_NZD=0.00`  
`ATTRIBUTABLE_SETTLED_TOLL_PAYMENTS=0`  
`INDEPENDENT_EXTERNAL_BUYERS=0`  
`PAID_FULFILLED_ORDERS=0`  
`VERIFIED_OUTCOMES=0`

A workflow success, commit, active Payment Link, unpaid session, PaymentIntent without attribution, internal database row, or public page does not change these values.

## Reusable acceptance stencil

For any paid API, agent call, or digital deliverable, require:

`OFFER_IDENTITY → AUTHORIZED_SCOPE → CHECKOUT → SETTLED_PAYMENT → IDEMPOTENT_ORDER → ENTITLEMENT/QUOTA → BOUNDED_EXECUTION → DELIVERY_RECEIPT → REFUND/RECONCILIATION`

Every transition needs an observable artifact and negative tests. Unknown is not pass. No duplicate toll system or replacement SKU should be built while this existing path remains unresolved.
