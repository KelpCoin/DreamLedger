# BrownEye Cortex Kingdom auction capability

## Canonical ownership

Kingdom owns `kingdom.auction.v1`. **MTG is the permanent CUBE master template and the highest-tested reference implementation**. DreamLedger is one distribution SPV. All target silos, including unrelated B2B sectors, are compiled from that master without copying master inventory, branding, payments, identities or customer information. Each deployed silo consumes a separately granted Kingdom capability and requires its own signed, deployment-bound Gauntlet allocation. A failed, absent, expired, cross-silo or tampered grant blocks writes with HTTP 503. The master integration and reusable clone compiler are staged in draft PR #913.

The existing Postgres/Stripe auction transaction implementation in the MTG master is the **reference adapter and quality floor**. Do not confuse an adapter with the shared capability or treat passing CI as a live service. CUBE can replicate the implementation contract into sector-specific adapters, including B2B reverse procurement when genuinely built and verified. Reuse the same allocation protocol for future backends, including local-first SQLite, but do not install a second database merely to pass tests.


## CUBE replication: master to every silo

```text
ELOHIM -> GAUNTLET (commercial case, scope, tests, explicit approval)
          |
          v
KINGDOM ASSET: kingdom.auction.v1 (code, contracts, grant verifier)
          |
          v
MTG MASTER SILO (gold test reference: not MTG-only ownership)
          |
          v
CUBE CLONE COMPILER -> isolated target SPV/silo blueprint
          |
          v
TARGET GAUNTLET + separate identity/store/storage/secrets/payments
          |
          v
TARGET ADAPTER -> approved release -> verified transactions/economics
```

`BEC-PRIME/capabilities/auction/clone-blueprint.mjs` compiles a request using the MTG master proof and a concrete commercial hypothesis. Target sectors may be supply chain, wholesale, equipment liquidation, government/private procurement, licensing, construction, digital inventory, or another approved niche. **An unrelated sector does not require MTG-compatible products.** The clone inherits *transaction interfaces, reliability tests, evidence contracts, release policies and quality thresholds*, not MTG data or brand identity.

- `english_ascending` is the only implemented live-adapter format in source. `reverse_procurement`, `sealed_bid`, `dutch_descending` and `bulk_lot` are **design-target formats only**, automatically held pending their own transaction engines and adversarial tests.
- B2B allocation additionally needs business identity, contract terms, tax/fees, invoice/settlement responsibility, supplier proofs, delivery and disputes. It is not granted merely because the MTG reference tests pass.
- Only the **MTG master** can define the gold regression baseline; derivative silos must pass both the inherited baseline and target-specific tests. Proven fixes can be promoted **back into the master through review**, then recompiled forward. Neither CUBE nor Elohim may automatically weaken security gates or copy sensitive records during this refinement cycle.
- Windows PowerShell may orchestrate a Python worker, Notion operational mirror, Zapier triggers, Super.io display surface or Kubernetes worker, when connected and authorized. These are *optional execution adapters*, not data sources of truth or automatic permission to publish, buy, sell, copy private content or charge money. The canonical transaction ledger and evidence stay isolated by SPV.

Reference test: `node --test tests/kingdom-auction-master-clone.test.mjs`. Result is a deterministic **PREPARED_NOT_AUTHORIZED** blueprint with SHA-256, not an activated auction or claim of revenue.

## Authority contract

1. A source `gauntlet-scorecard/v1` document has `overall: PASS` and `scope.id` equal to the target silo.
2. Owner explicitly approves exactly `kingdom.auction.v1` for that silo, provides an auditable approval reference, and selects `EXPERIMENT_APPROVED` or `REPEATABLE_MARGIN_VERIFIED` as a claimed basis. These labels attest approval, **not realized revenue**.
3. A trusted signer with a secret of at least 32 characters issues the allocation from the original scorecard bytes. It signs scorecard hash, economic basis, owner approval reference, action list, silo, deployment SHA, expiry. Never place the secret or signed policy issuance in the browser.
4. Server gate checks HMAC with constant-time comparison, exact silo ID, exact deployment SHA, action and validity window. Unset variables fail closed.
5. Even a valid grant NEVER overrides payment test-only mode, provider data plane availability, seller verification, legal review, inventory or Stripe webhook protections.

The resource allocation is **not** automatically inferred from the scorecard. The external approval and cryptographic signature are required so a user-editable scorecard or client header cannot self-authorize public money flows.

In Vercel set server-only environment variables (NO `NEXT_PUBLIC` prefix): `KINGDOM_AUCTION_ALLOCATION_SECRET`, `KINGDOM_AUCTION_ALLOCATION_JSON`. `VERCEL_GIT_COMMIT_SHA` ties the grant to the exact deployed source. Do not configure production until the owner approves the release. For local CI only, use `KINGDOM_AUCTION_DEPLOYMENT_SHA` with an isolated test key.

## Open-source reuse decision (31 Oct 2026)

- **Mercur + Medusa v2**: MIT-licensed core marketplace with sellers, admin/vendor panels, orders, commissions and optional Stripe Connect. Primary recommended *upstream integration candidate* for eBay-level commerce services: https://github.com/mercurjs/mercur . It is NOT verified as an auction bidding engine. Mercur also expects PostgreSQL and Redis; importing it immediately would not fix the exhausted Supabase volume.
- **Vendure**: strong mature commerce core, but GPLv3 and not a turnkey auction-bidding module: https://github.com/vendurehq/vendure . Read licensing terms before any commercial redistribution.
- **GoAuction**: narrow MIT real-time engine with optimistic locking, anti-sniping and WebSockets: https://github.com/vgartg/Go-Auction . Smaller upstream adoption. Inspect concurrency/security before any code copy or operational dependency.

**Decision**: preserve the actual MTG auction Postgres lock-based bidding + existing Stripe test-mode/identity/spine. Add a consumer-neutral, signed Kingdom authorization boundary now. Do not fork a second checkout, order, seller or payment system. Integrate Mercur only after a concrete measured feature-gap analysis and compatibility tests, not by blindly cloning another monorepo.

## Operational parity work NOT COMPLETE

A functioning eBay/Trade Me-level marketplace additionally needs provider-independent durable data recovery, verified production migrations, multi-silo tenant isolation, multi-user signup + verification, inventory/photos, search, watchlists, proxy bids, buy-now, seller dashboards, live notifications, verified payment/refund, shipping & tracking, buyer/seller reputation, disputes, abuse controls, tax compliance, legal responsibility for third-party money, monitoring, backups, and support. Neither this capability manifest nor the isolated MTG test suite proves those layers.

## Verification

Run `node --test tests/kingdom-auction-authorization.test.mjs` and `node --test tests/mtg-auction-gateway.test.mjs` using Node 24. CI runs database/Edge tests in the existing MTG auction transaction gauntlet; no external payments or migrations are executed by these tests.

Release state is **HOLD** until operator approval and signed live evidence. Live customer payment remains disabled.
