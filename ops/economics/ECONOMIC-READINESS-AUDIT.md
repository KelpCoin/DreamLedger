# Economic readiness audit and silo expansion

**Snapshot date:** 2026-10-20  
**Audit status:** BLOCKED  
**Verified DreamLedger revenue:** NZ$0.00  
**Live production changes:** None

## What live Stripe evidence says

A read-only inspection of the connected DreamLedger live Stripe account returned two successful historical charges: NZ$5.00 and US$1.00 in their original currencies. The two corresponding Stripe balance transactions were denominated in NZD and totalled NZ$6.67 gross, NZ$0.80 fees and NZ$5.87 net. Their charge records did not provide useful canonical offer attribution, and no independently reconciled fulfillment proof was joined. These are account-level funds movement, **not verified DreamLedger product revenue**.

The first 100 returned products included 95 active and five inactive records. The first 100 returned payment links included 50 active and 50 inactive records. Both lists were paginated, so these are sample-page counts, not full-account totals. Active objects are not proof of demand or sellability.

## Blocking offer mismatches

### Billboard founding tile, NZ$50

The canonical `public/billboard.html` surface links to a Stripe payment link that the live read-only API reports as inactive. The page simultaneously claims Stripe checkout is live. The page should not be distributed as a working checkout until a correct link, buyer input, inventory reservation, moderation/review, publication and durable proof path are independently reconciled. Do not fix this by simply swapping URLs.

### MTG Commander diagnostic, NZ$29

A live Stripe Payment Link is active at NZ$29.00, but the repository product `COMMANDER-DECK-DIAGNOSTIC-001` is held with checkout disabled, fulfillment disabled and `operator_required=true`. The fulfillment registry says the same SKU is ready with `operator_required=false`. Stripe's hosted confirmation tells the buyer to reply to the receipt with a decklist if one was not provided. These states contradict one another. An active link is not evidence of automated fulfillment.

The MTG worker code still requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Supabase RPC functions and the `marketplace-fulfillment` Storage bucket. A deployed always-on worker was not verified from the source alone.

### DreamMeez cosmetics

A live NZ$3.99 DreamMeez Supporter Sprout link exists, with cosmetic entitlement described in its metadata. This is the most obvious low-ticket **test candidate** among the inspected links, but the live signed-webhook to account entitlement, replay safety, buyer-visible delivery and receipt chain have not been proven end to end. Do not label it production-ready until that specific test passes.

## Code-level economic risks

- `BEC-PRIME/lib/revenueLedger.js` writes event, journal, ledger-entry and fulfillment records to local JSONL files. Its read-before-append checks are not atomic uniqueness constraints across concurrent processes, so duplicate webhook deliveries can race.
- `BEC-PRIME/start.js` uses Node `http.createServer`; the revenue ledger writes authoritative data to local files. This is not a drop-in Cloudflare Worker runtime or durable storage design.
- The inspected Commander worker is a polling Python process that depends on Supabase. Source code alone does not prove a production queue consumer or 64 live worker nodes.
- The named `cube_swarm_scaler.py`, `bec_tenant_spawner.py`, `beck_engine_rebuilt.py`, `silo-migration-10-domains.sql`, `schema_nz_mtg_silo.sql` and `seed_nz_mtg.sql` were not found at the checked paths in `KelpCoin/DreamLedger/main`. This does not prove a Studio/local copy is absent; it means those exact versions were not independently inspectable in the connected repository, so their implementation and benchmark claims remain unverified.
- Simulated signal rate, active Stripe products, payment links, and pipeline values do not count as revenue.

## Silo work prepared

`ops/silos/CUBE-SILO-CANDIDATE-REGISTRY.json` defines **19 candidate silo manifests**, led by the `nz-mtg` master:

1. MTG Singles & Commander, the canonical master at 0% platform take-rate.
2. DreamMeez cosmetics and avatar identity.
3. Free B2B supplier directory.
4. Supplier quote comparison and ETA normalization.
5. Music and media.
6. Musical instruments and audio gear.
7. Women's clothing and accessories.
8. Baby and kids.
9. Home and garden.
10. Electronics and gaming.
11. Sports and outdoors.
12. Books and comics.
13. Collectibles and vintage.
14. Vehicle and marine parts.
15. Crafts and creator goods.
16. Pet supplies and non-live-animal hobby goods.
17. Business equipment.
18. Contractor quotes and variations.
19. R&D tax and statutory evidence preparation.

For non-MTG candidates, seller listings remain a **free-listing test hypothesis** and the platform take-rate is intentionally unset. No demand is asserted. Each vertical must prove its own supply, intent, unit economics, isolation, checkout and fulfillment; MTG's evidence is not automatically transferable to other niches.

The Python generator produces per-silo manifests with unique IDs and domains, tenant isolation requirements, explicit hold states, zero copied inventory/users/secrets, no provisioned domain/database/payment link, and CUBE scale-up disabled. The generator does not run SQL or mutate production.

## Required order of work

1. Reconcile MTG's conflicting product, checkout and fulfillment records and prove one complete test-mode purchase-to-delivery cycle.
2. Test DreamMeez Supporter Sprout in test mode through webhook idempotency, account entitlement and retrievable proof.
3. Correct the billboard's inactive checkout link only after its inventory and post-payment proof path passes.
4. Make the JSONL ledger safe under concurrency and port stateful commerce to a durable, Workers-compatible repository before any Cloudflare production cutover.
5. Start free B2B listing and quote intake experiments, then use actual qualified supply and buyer intent to order further verticals.
6. Allow CUBE expansion only after real transaction-level net contribution and reliable fulfillment are measured. NZ$25 and NZ$120 EPV thresholds remain heuristics until validated on real traffic.

## Safety boundary

The audit uses a committed, sanitized read-only snapshot and checked-out source files. It does not re-query Stripe during future CI runs. Recheck provider objects before every release. No Stripe links, DNS, production database, service, secret or worker was changed. Candidate manifests are not live silos.
