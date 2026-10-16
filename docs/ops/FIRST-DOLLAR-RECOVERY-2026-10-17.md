# First-dollar recovery and production safety audit
Date: 2026-10-17
Status: HOLD for live checkout activation. No revenue event is claimed.

## Findings from live Supabase function inventory

The project `wbwgroygjeyukkspnqiy` has active deployed functions:
- `marketplace-diagnostic-delivery` v11
- `marketplace-diagnostic-input` v6
- `marketplace-diagnostic-verify` v4
- `stripe-revenue-41104f355d6878cdd6d1f9dc` v28
- Several older `dreamledger-stripe-webhook*` functions also remain active.

The current repository main branch did not contain source files at the expected paths for the three marketplace diagnostic functions. Deployed source must be recovered into version control before a controlled deployment can be reproduced. Do not infer that a function is absent from production because its source is absent from GitHub.

## Actual Commander diagnostic contract

1. The delivery URL is a **paid-order intake page**, not proof that the final diagnostic report was delivered. It retrieves the Checkout Session from Stripe, requires `livemode=true` and `payment_status=paid`, requires `metadata.marketplace_listing_id`, then looks up a matching `marketplace_orders` row before presenting the decklist form.
2. The input function re-retrieves the Checkout Session, checks `payment_status=paid`, checks the expected diagnostic SKU metadata, finds a `marketplace_fulfillments` row, and calls `marketplace_submit_diagnostic_input`.
3. The verifier checks that an artifact exists in private storage, recomputes SHA-256, and calls `marketplace_complete_diagnostic_fulfillment` with the lease token and worker identity.
4. The canonical revenue webhook records payment attribution and queues a fulfillment request, but returns `ra000001_promoted:false`. That is the correct non-promotion posture while fulfillment and evidence remain unverified.

A successful payment redirect or a queued fulfillment request is not the complete paid-to-delivered chain. Do not count the first-dollar event until settlement, attribution, successful artifact fulfillment, buyer delivery, and the canonical ledger reconciliation all agree.

## Critical problems in the pasted `setup_schema_and_cron.sql` / `stripe-webhook/index.ts` blueprint

**Do not execute the pasted blueprint in production.** It is not safe as written:
- The four `FOR ALL USING (true)` policies omit a restrictive `TO service_role` clause and would permit broad row access to any role granted table access. RLS policy names do not themselves restrict a policy to service role.
- The webhook defaults missing `amount_total` to 4900 and missing buyer email to `anonymous_buyer`; financial records must never be fabricated from defaults.
- It does not require `session.payment_status === "paid"`, live mode, expected currency, or SKU/price attribution before writing the payment.
- It does not verify that the checkout session belongs to the intended product or account.
- It upserts the payment but unconditionally inserts a fossil receipt, so Stripe retries can create duplicate receipts.
- It ignores the fossil insert error and can return a success status without a receipt.
- The hash includes a newly generated timestamp, making repeated processing of the same event produce a different hash.
- It labels the event `RA_000001_SETTLED_AND_LOCKED` before verifying fulfillment and delivery. This contradicts DreamLedger's evidence gate.
- The cron function contains a placeholder URL and no secret-authenticated request contract. Do not schedule it until the target function and authentication are configured.
- Creating a generic `public.payments` table risks a parallel ledger beside the existing `revenue_orders`, `event_ledger`, `economic_events`, and reconciliation tables. Reuse the canonical ledger rather than introducing another.

## Safe repair sequence

1. Recover and version the deployed diagnostic function sources.
2. Confirm current environment configuration without printing secret values.
3. Test with Stripe test-mode events and a non-production Supabase target. Test invalid signature, unpaid session, wrong currency, wrong SKU/amount, duplicate event, failed DB write, and fulfillment retry.
4. Confirm that event idempotency, order creation, entitlement, fulfillment request, artifact hash, delivery proof, and reconciliation are durable and consistent.
5. Only then update the live webhook route. Keep the current route intact until the replacement is proven; do not enable two competing canonical settlement paths.
6. Re-enable the existing Payment Link only after its listing metadata, catalog price, and complete fulfillment route match.
7. Run a new production acceptance check against the deployed commit SHA and actual health routes.
8. Promote `RA_000001` only from reconciled external payment plus fulfillment and delivery evidence.

## Silo contract additions

The template now defines:
- `language_profile`: locale, tone, audience, preferred/avoided terminology, and claim rules.
- `word_banks`: a primary silo bank plus explicit override files.
- `schemas`: independent catalog, offer, product, checkout, and evidence schema references.
- `allow_invented_products=false` and evidence requirements for performance claims.

These are source-controlled contracts. They do not mean each existing silo has been migrated or validated yet. Clone-time validation must be wired into the factory and its tests before treating the new contract as enforced.

## Source drift recovered in this branch

The three deployed Commander diagnostic functions have been copied from the live Supabase function registry into the normal `supabase/functions/` source paths in this branch:
- delivery v11
- input v6
- verify v4

The deployed canonical revenue webhook v28 and older `dreamledger-stripe-webhook-v3` v13 have been snapshotted under `ops/recovered-production/` for comparison. The canonical webhook source in `supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts` on main is not byte-identical to deployed v28. Treat this as source drift. Do not overwrite the active production version with main until the differences are reviewed and tests pass.

This branch intentionally does not deploy functions, alter Stripe endpoint routing, enable a Payment Link, or change production tables. Those are live-money actions and remain gated on test-mode evidence.
