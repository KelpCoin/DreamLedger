# Path A auction invariant isolated replay

Purpose: disposable PostgreSQL replay for migration `20261001160000_path_a_auction_invariants.sql` before any Supabase production apply.

Required environment:
- `DATABASE_URL`: isolated PostgreSQL branch/database only.
- Never point this at Supabase production.

Run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261001160000_path_a_auction_invariants.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/path_a_auction_invariants.sql
```

Success criterion: every assertion prints `PASS` and both commands exit 0. Any failure is a hard stop. Do not apply the migration to Supabase production from a failed replay.

Required assertions:
1. Unauthenticated callers cannot execute `place_auction_bid(text,bigint)`.
2. Missing auction returns `AUCTION_NOT_FOUND`.
3. Opening requires seller, trader disclosure, direct-contract confirmation, and matching private compliance record.
4. Path A rejects non-A path, platform proceeds, and commission.
5. Seller self-bidding is rejected.
6. Closed/expired auctions reject bids.
7. Bids are positive and strictly above current bid.
8. Concurrent bids serialize on the auction row lock.
9. Bidder identities are not publicly exposed and users can only read their own bids.
10. Compliance records are inaccessible to anon/authenticated roles.
11. Expiry closure sets close timestamps and 12-month retention.
12. Path A contains no Stripe Connect/settlement/payout/commission invocation.
13. Existing production-like rows and RLS are reviewed before production application.

This file is a harness specification only. It does not claim that an isolated replay has run.
