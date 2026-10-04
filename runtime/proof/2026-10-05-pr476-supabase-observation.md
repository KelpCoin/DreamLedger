# PR #476 Supabase Production Observation

Date: 2026-10-05
Repository: KelpCoin/DreamLedger
PR: #476
Observed head: 42956d4fb9ee56b8d7f87d830a5df4fa75e22fe5
Supabase project: wbwgroygjeyukkspnqiy

## Measured state

- Supabase control-plane project status: ACTIVE_HEALTHY.
- Supabase Edge Function mtg-deck-catalog: ACTIVE, version 2.
- Current implementation uses supabase-js Data API/PostgREST, not a raw Postgres client.
- Current PR schema is public.mtg_decks with owner_id and title.
- Production table/schema cannot currently be queried through the Supabase database control path.
- Supabase MCP database calls fail with ECONNREFUSED to the project's IPv6 direct database address.
- Edge Function logs show PostgREST PGRST002 and HTTP 503 while querying public.mtg_decks.
- The Edge Function itself returns HTTP 500 because its PostgREST request fails.
- No production mtg_decks row was created.
- No buyer, payment, revenue, fulfillment, or economic outcome was created or changed.

## Interpretation

The measured blocker is DATABASE_OBSERVABILITY / DATABASE_REACHABILITY.

The historical hypothesis that the Edge Function itself uses a raw Postgres connection is false for the current implementation. It uses supabase-js.

The observed PGRST002 means PostgREST cannot build/query its database schema cache. This is not yet sufficient evidence to claim a specific root cause such as IPv6 incompatibility, a banned IP, or a missing exposed schema. Those remain hypotheses.

## Next safe action

Determine why the Supabase database/PostgREST data plane cannot reach/build against the database. Do not change the MTG schema, add test fixtures, alter economic state, or enable paid IPv4 infrastructure until the exact failure path is established.

## Acceptance gate

PR #476 remains blocked until production database observability is restored and the existing owner_id/mtg_decks implementation passes its acceptance tests.

## Economic boundary

TEST -> CATALOGUE -> DISTRIBUTION remains separate from:

REAL BUYER -> SETTLED PAYMENT -> FULFILLMENT -> INDEPENDENT PROOF -> VERIFIED

Economic scoreboard remains unchanged.
