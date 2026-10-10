# B2B marketplace operations and release gates

## Current implementation in the draft marketplace PR

- Public discovery reads published rows from the existing `marketplace_listings` table.
- RFQs and supplier offers use the new `marketplace_b2b_rfqs` and `marketplace_b2b_offers` tables defined in `supabase/migrations/20261010120000_marketplace_b2b_rfq_offers.sql`.
- B2B writes require a valid Supabase Auth bearer token and confirmed email. The browser must never receive the service-role key.
- RFQ and offer creation require a client-supplied `Idempotency-Key`. Reusing a key with a different payload returns a conflict.
- Seller listings require completed Stripe Connect onboarding and enter the existing versioned `review` state. Only authorized moderators can publish/reject them through `transition_marketplace_listing`; the database payout gate still applies.
- Sellers must explicitly opt in to `agent_purchasable` for their published listing to appear in A2A discovery. Agent discovery can show listings while checkout remains gated.
- Supplier offers require an existing Stripe Connect seller account with onboarding complete, charges enabled and payouts enabled.
- Offer visibility is restricted to the RFQ buyer and a supplier who submitted an offer.
- B2B order routes intentionally fail closed until offer acceptance creates an order in the existing canonical `marketplace_orders` model and that order is bound to Stripe settlement and fulfillment.

## Required deployment configuration

On the existing BEC-PRIME service, configure the existing Supabase URL and service-role key plus the public Supabase Auth key:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`

The service-role key must remain server-side. The B2B page receives only the public URL and public Auth key through `GET /api/b2b/config`.

The `marketplace-seller-onboarding` Edge Function must be deployed with Stripe and Supabase secrets. The Stripe Connect account-updated webhook must be active and tested against the correct deployed function. The presence of source code alone is not deployment proof.

## Recovery and rollout order

1. Restore PostgreSQL through the Supabase provider. Do not delete WAL segments or run `pg_resetwal`.
2. Run the new migration only after inspecting the live migration history and confirming the target tables do not already exist in a conflicting form.
3. Verify the new tables, constraints, grants, and RLS with read-only SQL and a disposable authenticated test user.
4. Verify Supabase Auth signup, confirmation, login, and expired-session behavior.
5. Verify seller onboarding, Stripe Connect `account.updated` webhook delivery, and the seller account status row.
6. Test RFQ and offer creation, idempotent retry, idempotency-key conflict, buyer/supplier access boundaries, and DB outage fail-closed behavior.
7. Implement offer acceptance using the existing `marketplace_orders` table and existing state-transition RPC. Do not create a parallel order ledger.
8. Bind the accepted order to Stripe Checkout, atomic/idempotent webhook settlement, entitlements, fulfillment, delivery evidence, refunds and disputes.
9. Run the complete repository gates and an end-to-end test in test mode. Keep test transactions explicitly labelled and excluded from external revenue.
10. Promote only after a production smoke test confirms a real order can be safely created and the rollback path is documented.

## Current release state

This code is in a draft PR. The migration is not applied, the Supabase SQL data plane has been reported unreachable, and no production seller onboarding or marketplace order was tested here. The B2B order/checkout endpoint remains disabled by design until the canonical order and settlement path is completed. Do not describe the B2B marketplace as fully launched yet.
