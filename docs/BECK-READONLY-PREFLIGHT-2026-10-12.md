# BECK Read-Only Preflight Report

Checked: 2026-10-12 UTC
Repository: KelpCoin/DreamLedger
Branch: fix/beck-canonical-offer-and-supabase-failure
Scope: read-only inspection only. No production SQL, Stripe settings, deployments, database writes, or external customer actions performed.

## Decision

**BLOCKED: do not enable or claim a complete Commander payment-to-delivery loop yet.** The PostgreSQL data plane refuses a read-only query, and Stripe live authentication has not been proven in this session. Verified external revenue remains NZ$0.

## Evidence

### 1. Supabase control plane and data plane disagree

- Project: `wbwgroygjeyukkspnqiy` (DreamLedger, ap-southeast-1, PostgreSQL 17).
- Supabase project metadata reports `ACTIVE_HEALTHY`.
- A read-only `SELECT 1` via the connected Supabase SQL tool failed with `connect ECONNREFUSED 2406:da18:1691:a200::3484:5432`.
- Interpretation: control-plane status is not proof of database connectivity. Do not run migrations, fulfillment writes, slot drops, restarts, or clone promotion until the provider restores PostgreSQL access and read-only queries pass.
- Next proof: `SELECT 1;`, then inspect replication slots and WAL retention only after connectivity returns. Do not drop a slot unless its purpose and safety are confirmed.

### 2. Commander product contract in repository

File: `BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json`

Observed values:
- Canonical product ID: `COMMANDER-DECK-DIAGNOSTIC-001`
- Legacy SKU field: `CMD-DIAG-29`
- Price: NZD 29
- Payment Link ID: `plink_1UFFZFEGgEAnUFF9LHNMWTDl`
- Product metadata declares the checkout intake URL as `https://dreamledger.org/diagnostic-input.html?session_id={CHECKOUT_SESSION_ID}`.
- Evidence status: `awaiting_first_payment`; transaction ID is null.

This establishes the repository's product-side contract only. It does **not** establish what metadata is currently attached to the live Stripe Payment Link, what the production Commander intake resolver reads, or whether a paid session reaches fulfillment. Do not edit live link metadata or deploy a resolver until those are read and a test path is available.

Boundary repair acceptance criteria:
1. Read the actual Stripe Payment Link metadata and the deployed Commander intake resolver.
2. Choose one canonical SKU contract while accepting the legacy SKU only as an explicit compatibility alias.
3. Verify paid Checkout Session metadata and PaymentIntent metadata separately; do not assume either automatically copies to the other.
4. Add tests for canonical SKU, legacy alias, unknown SKU, unpaid session, wrong Payment Link, duplicate session, and idempotent fulfillment.
5. Exercise against a working non-production database before any production release.

### 3. Stripe CI authentication

- Repository workflow `.github/workflows/economic-loop.yml` only runs its Stripe preflight when repository variable `STRIPE_LIVE_ENABLED` is `true`.
- It passes `secrets.STRIPE_SECRET_KEY` to `scripts/Verify-StripeLiveAuth.mjs`.
- The verifier fails closed if the flag is off, the key is absent/non-live, the Stripe API rejects it, or the returned account ID differs from the expected account.
- The connected inspection cannot read or change repository secrets, and no secret value was requested or exposed.
- Required external action: a repository administrator must confirm the protected secret and variable in GitHub Actions settings, then rerun the workflow. Acceptance is a successful authenticated `GET /v1/account` with the expected account ID, not a compile pass.

### 4. Existing Quote Compare function is not the Commander resolver

The deployed `quote-intake` Edge Function checks a paid live Checkout Session against Payment Link `plink_1UKq77EGgEAnUFF9KOr1SuUY` and SKU `QUOTE-COMPARE-49`. This is a separate offer. Do not modify it as a proxy fix for the Commander contract.

### 5. Pull request / CI state

- Draft PR: https://github.com/KelpCoin/DreamLedger/pull/660
- Latest inspected commit before this report: `433271f7db034f7e2a2ff39c3fd6faacc1a76154`
- The Checkout Metadata Contract workflow passed at that commit.
- Multiple scheduled/push workflows failed at that commit; these are not equivalent to a successful commercial end-to-end test.
- The e-commerce smoke failure previously identified missing valid claim URLs for `EDH_QUINTORIUS_0002` and `EDH_DWYNEN_0003`. Do not invent replacement destinations.

## Release gates

- [ ] Supabase read-only SQL succeeds twice consecutively.
- [ ] Commander product, live Payment Link metadata, and deployed resolver agree on the canonical SKU contract.
- [ ] Stripe CI preflight passes for the expected account without exposing secrets.
- [ ] Non-production intake tests pass, including duplicate-session/idempotency cases.
- [ ] One real external payment settles, the promised diagnostic is delivered, and payment/order/delivery evidence matches.
- [ ] Only then update the revenue scoreboard. Until then: **NZ$0 verified revenue**.

## Safety boundary

This report is a read-only preflight, not a production repair. No database mutation, Stripe configuration change, deployment, checkout activation, or customer contact was performed.
