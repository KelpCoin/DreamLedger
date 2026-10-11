# MTG clone-readiness gate

Status: **NOT CERTIFIED** until every production gate below has fresh evidence. This document is a release checklist, not proof that any gate has passed.

## Changes in this branch

- Align Edward Kenway (EDH_0001) public catalogue price to NZD 400, the owner-confirmed intended price.
- Add a dependency-free Node test suite for catalogue IDs, MTG SKU uniqueness, enabled/disabled checkout invariants, and the known NZD 29 / NZD 400 listings.
- Add a GitHub Actions gate that runs the static catalogue tests on relevant pull requests and pushes to main.

## Required release gates

1. **Catalogue and Stripe parity**
   - Compare each enabled MTG listing against the live Stripe Payment Link: active state, currency, amount, product/price identity, and Checkout Session metadata.
   - Confirm each SKU resolves to the authoritative revenue catalog and active SKU registry.
   - Specifically investigate the Founding Billboard metadata: the Payment Link metadata SKU observed during audit was `DL-BILLBOARD-100X100-3000-001`, while the public catalogue SKU is `DREAMLEDGER-BILLBOARD-FOUNDING-001`. Do not normalize this silently; choose and test one canonical mapping.

2. **Webhook correctness**
   - Verify Stripe signature before parsing or mutating state.
   - Prove same-event replay is idempotent and concurrent deliveries cannot create duplicate orders, entitlements, fulfillment requests, transfers, or ledger entries.
   - Make event claiming and the critical database side effects atomic where possible; rely on database uniqueness constraints and transactional RPCs rather than a read-then-write check alone.
   - Verify failed partial processing is safely retryable and never permanently marked complete too early.

3. **Persistence and recovery**
   - Validate Supabase data-plane read/write health and a controlled recovery/backup restore before production checkout tests. A dashboard health label alone is insufficient.
   - Keep production mutations disabled while the database is unhealthy.
   - Capture migration state, backup evidence, and restore-test evidence.

4. **Order and fulfillment lifecycle**
   - Confirm a paid NZD session creates one order and one fulfillment request, with amount, currency, SKU, Checkout Session, Payment Intent, and event references reconciled.
   - Confirm unpaid sessions, invalid signatures, wrong currencies, wrong amounts, unknown/inactive SKUs, and cross-silo metadata are rejected without partial economic claims.
   - Verify physical-deck shipping/dispatch evidence and digital diagnostic delivery separately. A queued request is not fulfillment evidence.

5. **Security and isolation**
   - Review RLS and service-role access for marketplace, orders, entitlements, fulfillment, evidence, and seller payout tables.
   - Prove guest checkout cannot read another buyer's data; authenticated seller/buyer actions are scoped to the correct identity and listing.
   - Ensure the MTG clone gets separate public configuration, allowed origins, webhook routing, secrets, storage scope, and tenant/silo identity. Never copy production secrets into a clone.

6. **Operational release**
   - Test CI, deployment health, checkout redirect, error paths, rate limits, logs without sensitive payment data, alerting, and rollback.
   - Run the clone in staging with isolated test-mode Stripe and a separate database before enabling live mode.
   - Record commit SHA, test outputs, migration versions, environment/config checks, and an explicit release decision.

## Truth labels

- **PASS**: assertion executed and expected evidence captured.
- **FAIL**: assertion executed and contradicted the expected result.
- **BLOCKED**: prerequisite missing or test could not run.
- **UNOBSERVABLE**: available evidence cannot establish the claim.
- **SIMULATED**: local mechanism exercised without proving an external economic event.

A successful static catalogue test does not prove a live payment, a settled external payment, fulfillment, or revenue. Never label a simulated checkout as revenue.
