# DreamLedger shared auction integration v1

Status: **implementation proposal in review; not deployed**.

## Decision

Use the existing DreamLedger commerce kernel and silo registry. Add one shared auction primitive keyed by `silo_id + source_type + source_id`; do not fork the platform per vertical and do not copy an unreviewed GitHub project into production.

The existing MTG migration already introduced `mtg_auctions` and `mtg_bids`, but that is MTG-specific and its bid insert policy does not enforce the current-price increment, active window, seller exclusion, concurrency, or idempotency at the database boundary. The new shared kernel is additive and does not rewrite those tables. MTG adoption should be a separately reviewed adapter/migration after this contract is accepted.

## Silo mapping

- MTG / HappyHomarid: singles, sealed product, Commander decks; preserve exact printing, language, condition, quantity, seller proof and 0% platform fee.
- Collectibles: item identity, authenticity/condition evidence, provenance and shipping profile.
- Clothing / baby goods: size, condition, safety/recall flags where relevant, returns and shipping.
- Music / media: format, edition, condition, digital/physical delivery distinction and rights metadata.
- B2B/RFQ: use a distinct procurement/bid type with private offers; do not expose sealed offers as public auction bids.
- Adult/Amplissa: silo-isolated catalog, identity, access and distribution; no cross-silo public mixing.

All auctions are discovery/offer mechanics only. Payment, payout, refund, fulfillment and buyer-retrievable receipt remain on the existing DreamLedger commerce path.

## Bid safety contract

- Bid writes only through `place_marketplace_auction_bid` (authenticated caller).
- Lock the auction row during bid acceptance to serialize competing bids.
- Reject seller self-bids, non-open or unapproved auctions, bids outside the time window, invalid amounts and bids below current price + minimum increment.
- Require a per-bid idempotency key. A retry returns the prior accepted bid.
- Never expose bidder identity in public discovery responses.
- Seller/client roles cannot directly insert or mutate auction/bid state.
- Publication approval is a trusted human/reviewer action, not an untrusted seller update.
- Auction completion creates a **winner/payment-pending** state only. No paid status is inferred from the winning bid. Settlement must be independently confirmed, attributed, fulfilled and supported by retrievable delivery evidence before revenue is verified.

## API adapter

`api/auctions.js` exposes:
- `GET /api/auctions?silo_id=mtg`: lists approved, open auctions under existing RLS.
- `POST /api/auctions`: accepts `auction_id`, `amount`, and `idempotency_key`, forwards the caller's Supabase JWT to the bid RPC, and never uses a service-role key.

The route fails closed if URL/anon-key configuration is missing and applies an eight-second upstream timeout. It is source-controlled but not yet production-verified. Do not advertise it as live until the migration is applied, environment variables are verified, deployment completes, and end-to-end tests pass.

## Cloud-first deployment sequence

1. Run static contract tests and SQL/API syntax checks.
2. Confirm Supabase database connectivity and migration history are healthy.
3. Review the existing MTG auction policies and define a migration/adapter path. Do not assume this additive migration automatically secures legacy `mtg_auctions`.
4. Apply migration in a controlled window with backup/rollback plan.
5. Test concurrent bids, replayed idempotency key, self-bid, late bid, unapproved auction, reserve-not-met, and anonymous access.
6. Deploy the API route with `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) configured; never put the service-role key in a browser.
7. Add a payment/fulfillment handoff only after a trusted auction close and human-approved checkout policy. Do not auto-charge bidders.
8. Roll out MTG first. Promote other silo IDs only after isolation, economics, refund/dispute and delivery tests pass.

## Open-source audit

The GitHub `online-auction` topic contains multiple student/demo implementations, including projects using Firebase, MongoDB, JSON-file storage, Stripe and various frontend stacks. Several candidates have no declared license. No third-party source is copied in this change. Reuse patterns only after license, maintenance, security, auth, race-condition, data model and dependency review. DreamLedger's current schema and settlement contract are a closer integration target than importing an entire competing stack.

## Proof boundaries

This PR proves only that the migration, API adapter and contract checks are present in source control. It does **not** prove database migration, production API deployment, successful bids, checkout, settlement, delivery or revenue.
