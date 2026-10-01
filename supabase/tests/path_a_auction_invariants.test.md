# Path A auction invariant integration tests

These tests must run against an isolated Supabase branch with disposable users and must not use production identities or live payment rails.

1. Unauthenticated callers cannot execute `place_auction_bid(text,bigint)`.
2. An authenticated caller bidding on a missing auction receives `AUCTION_NOT_FOUND`.
3. An auction cannot be opened without a seller, trader disclosure, direct-contract confirmation, and matching private compliance record.
4. Attempts to set `auction_path <> 'A'`, `platform_receives_proceeds = true`, or `platform_commission_bps <> 0` fail at the database boundary.
5. The seller cannot bid on their own auction.
6. Closed and expired auctions reject bids.
7. Bid amount must be positive and at least one minor currency unit above the current recorded bid/highest bid.
8. Two concurrent bids against one auction serialize through the row lock. A bid that becomes too low while waiting is rejected.
9. Authenticated users can select only their own bid records. Public endpoints must never expose bidder user IDs.
10. Anonymous and authenticated roles cannot read or mutate `auction_seller_compliance_records`; service-role backend can maintain records.
11. Expiry closure sets `closed_at`, `bids_closed_at`, and a 12-month `retain_until` value.
12. No Path A function invokes Stripe, Connect transfers, payouts, platform settlement, or commission calculation.
13. Existing production rows and current RLS policies are reviewed on a branch before applying this migration to production.
