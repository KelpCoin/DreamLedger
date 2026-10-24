# DreamLedger marketplace: reuse map

Inspected 22 October 2026 (NZ). This is a source-backed assembly decision, not a
claim that the marketplace is deployed, economically validated or complete.
Reference pins are in `marketplace-repository-manifest.json`. A reviewed branch head
is not an audited dependency version; choose and test released package versions at
integration time. No third-party marketplace source was copied in this change.

## Decision

Keep DreamLedger's shared commerce domain and existing job/evidence infrastructure.
Borrow focused libraries and adapt selected seller/admin experiences. Mercur is the
strongest inspected full-marketplace alternative, but installing its entire backend
would add Medusa, PostgreSQL and Redis and a competing order/payment authority.
Evaluate it in isolation before replacing any canonical commerce module.

The user architecture image shows cloud-authoritative economic state, Neon, optional
local SQLite/GPU work and Cloudflare ingress. Preserve that boundary: local work
cannot sell the same inventory independently of online reservations. The Node 24
SQLite auction adapter added in this branch is a private integration/test slice,
not the final Workers/Neon migration or a new production hosting decision.

## What already exists

| Capability | Existing source | What is established / what remains |
|---|---|---|
| Commerce and reservations | `BEC-PRIME/runtime/MarketplaceCommerce.js` | Offers, reservations, orders and disputes exist. PR #804 fixes buyer-scoped replay and adds agent discovery. Still needs unified inventory and secure identity. |
| Human storefront | `public/marketplace.html`, `public/auctions.html` | Existing surfaces. Auction page previously invented sample lots on API failure; this branch removes that behavior. |
| Auction primitives | `BEC-PRIME/auction-engine.js`, PR #790 | Original JSON engine restarted expired lots. PR #790 provides a row-locked SQL alternative but depends on Supabase auth/RPC. Neither is evidence of live production auctions. |
| Accounts | `BEC-PRIME/routes/auth.js` and account recovery | Password records exist. Legacy cookie identity is not sufficient authentication for money-related actions. Requires consolidated secure sessions and recovery. |
| Seller payments | `BEC-PRIME/runtime/MarketplaceCommerce.js`, marketplace routes and webhooks | Payment-shaped paths exist. Seller-direct charge mode, account fee/loss settings and refund reconciliation require verification. |
| Agent authority | `BEC-PRIME/runtime/AgentAuthority.js`, `AuthorizationFirewall.js` | Existing authority concepts to retain; authenticate delegation and budget atomically before paid actions. |
| Evidence and jobs | `AgentBridgeEventLedger.js`, `EconomicJobWorkerAdapter.js`, CUBE/public.jobs | Reuse the existing dispatch/evidence substrate. Do not introduce another queue or revenue ledger. |
| Messaging | `BEC-PRIME/routes/conversations.js` | Existing conversation substrate; review identity, abuse controls and silo isolation before public reuse. |
| Provider exit | PR #777; dispatcher PR #806 | Existing Cloudflare/Neon migration work. Its current PR evidence still reports unpassed production/data gates. |
| Broader marketplace scaffolds | PRs #681, #782, #783, #797 | Relevant existing workstreams, not independently validated feature-complete platforms. |

Source links: [DreamLedger](https://github.com/KelpCoin/DreamLedger),
[PR 804](https://github.com/KelpCoin/DreamLedger/pull/804),
[PR 790](https://github.com/KelpCoin/DreamLedger/pull/790),
[PR 777](https://github.com/KelpCoin/DreamLedger/pull/777).
BrownEye-CUBE was found and searched; that search returned no auction implementation.
This does not prove there is no related code anywhere in the repository.

## Repositories to assemble from

| Need | Repository | Recommendation and boundary |
|---|---|---|
| Vendor/admin marketplace experience | [mercurjs/mercur](https://github.com/mercurjs/mercur) | Best full-platform comparison. MIT core includes vendor/admin dashboards, offers and multi-vendor primitives. Its SDK/UI expect Mercur APIs; adaptation is real work, not copy/paste. Enterprise extras are separately licensed. No auction implementation was located in the inspected tree. |
| Commerce core underneath Mercur | [medusajs/medusa](https://github.com/medusajs/medusa) | Evaluate only if replacing existing order authority becomes justified. MIT except enterprise materials. Do not run two independently authoritative inventory/order systems. |
| Authentication | [better-auth/better-auth](https://github.com/better-auth/better-auth) | MIT. Candidate for consolidated secure sessions, OAuth and account lifecycle. Migrate existing identities/passwords deliberately; invalidate legacy ID cookies. |
| Faceted catalogue search | [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch) | Community search candidate; current repository has MIT and BUSL-1.1 portions. Pin community release/features. Index is derived, never stock authority. |
| Photo upload | [transloadit/uppy](https://github.com/transloadit/uppy) | MIT. Browser camera/file upload with existing UI. Use scoped upload authorization, limits and private staging before publication. Its hosted service is not mandatory. |
| Image processing | [lovell/sharp](https://github.com/lovell/sharp) | Apache-2.0. Node/local-worker thumbnails and image normalization. Native dependency: not a drop-in Workers module. Bound image dimensions and memory. |
| Card payments | [stripe/stripe-node](https://github.com/stripe/stripe-node) | MIT official SDK. Seller-direct charge adapter, signed connected-account webhooks and refund/settlement reconciliation. SDK adoption alone does not establish liability settings or compliance. |
| MCP tools | [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | Wrap the same commerce commands, not separate buying logic. Current license describes MIT-to-Apache transition and CC-BY documentation; retain applicable notices for selected version. |
| Agent communication | [a2aproject/a2a-js](https://github.com/a2aproject/a2a-js) | Apache-2.0 official JS SDK. Tasks and interoperability; not permission to spend. Agent mandates, revocation, ceilings and receipts remain application responsibilities. |
| Metered machine payments | [x402-foundation/x402](https://github.com/x402-foundation/x402) | Apache-2.0. Primary upstream named by Coinbase's README; coinbase/x402 is now a development fork. Optional after service delivery works. Payment protocol is not automatically escrow or proof of output correctness. |
| Local outbound connection | [cloudflare/cloudflared](https://github.com/cloudflare/cloudflared) | Apache-2.0. Candidate tunnel transport for optional workers. Does not by itself establish end-to-end application encryption or zero cloud plaintext exposure. |
| Encrypted job envelopes | [dajiaji/hpke-js](https://github.com/dajiaji/hpke-js) | MIT. Candidate only where envelope encryption is required. Key management, replay protection and signing are separate controls. Prefer runtime crypto for Ed25519 before adding another signing library. |
| MTG enrichment | [mtgjson/mtgjson](https://github.com/mtgjson/mtgjson) | MIT build scripts; retain existing ingestion mapping. Data, images and price-provider commercial rights need their own checks. Catalogue rows are not owned stock. |
| Barcode capture | [zxing-js/browser](https://github.com/zxing-js/browser) | MIT. Browser barcode decoding for media/books. A barcode yields candidate release matches, not verified physical pressing identity. |

## Important incompatible defaults

Mercur's [Stripe Connect guide](https://github.com/mercurjs/mercur/blob/main/apps/docs/resources/integrations/stripe-connect.mdx)
explicitly uses separate charges and transfers: the platform charges the buyer,
then transfers to sellers. This conflicts with the requested seller-direct model.
Do not import that payout workflow unchanged. The inspected guide also says refund
and transfer reversal need separate orchestration.

[Sharetribe Go](https://github.com/sharetribe/sharetribe) describes itself as old,
source-available software no longer actively maintained. It is not the preferred
foundation. Chatwoot is a possible later support desk, not the marketplace engine;
its enterprise directory is separately licensed. Novu and Vendure were discovery
candidates but not validated enough in this pass to recommend installation.

## Gaps no repository automatically closes

- Physical inventory ownership, deck/lot allocation and cross-channel double-sale prevention.
- Secure seller and buyer identity, account recovery and delegated-agent authority.
- Auction finalization, winner-only checkout, non-payment expiry and relisting policy.
- Direct charge fee ownership, loss responsibility, refunds, dispute handling and delivery.
- NZ Post/carrier credentials, rates, labels, lost-parcel process and return workflow.
- Category grading, actual item evidence, moderation, verified-sale reputation and fraud response.
- Data restore, provider cutover, operational monitoring and measured cost per transaction.
- Customers and liquidity. No GitHub repository supplies verified buyers.

Core B2B remains zero platform commission. Optional subscriptions and A2A execution
fees are separate, explicitly quoted services; do not imply free card processing.

## Build order and acceptance

1. Complete account/security and cloud persistence boundaries; preserve provider-exit work.
2. Unify stock reservations for fixed-price and auctions. Run final-unit races and retry recovery.
3. Complete seller listing, photo, review, browse, bid and close flows using one authority.
4. Connect winner-only direct checkout and reconcile signed payment/refund events in sandbox.
5. Fulfil a real, approved listing end to end with retrievable delivery and settlement evidence.
6. Add catalogue search, seller-dashboard improvements and media/clothing adapters.
7. Expose existing commands through MCP/A2A with scoped mandates; add metered execution later.

Planning ranges, not commitments: an own-stock sales replacement might take 2-4
weeks after provider/payment access works; a public multi-seller marketplace with
auction, refund and dispute handling roughly 8-12 weeks of focused integration and
testing. These are not estimates of replacing Trade Me's audience or national reach.

## This branch's implementation proof

New Node 24 SQLite/WAL adapter, existing-account password bridge with independent
random expiring auction sessions, draft/reviewer publication, bidding, anti-sniping,
atomic winner/payment-pending orders, and seller activity page. Old JSON bid writes
are retired; historical data is untouched. No fake listings or local fake bid success.

Run `node scripts/verify-user-auctions.cjs` from the repo. It writes
`evidence/user-auctions/proof.json` and `test.log`, including source hashes.
The proof covers unit, concurrent-database and HTTP integration tests plus JS parse
checks. Browser rendering, public deployment, agent delegation, payment execution,
legacy account lifecycle security and shared cross-channel inventory remain unproven.

Enablement remains off by default. The adapter requires Node 24, a persistent local
filesystem and explicit `USER_AUCTIONS_ENABLED=1`, `AUCTION_SQLITE_PATH`,
`AUCTION_REVIEWER_IDS` and the canonical account data directory. Do not enable this
publicly before consolidated authentication and shared inventory integration pass.
No automatic migration from historical auction JSON or live database is attempted.
