# DreamLedger MTG Master Silo: Production Readiness

**Status:** implementation contract and readiness plan; not a production certification.  
**Reviewed:** 2026-10-14  
**Canonical surface:** `/mtg/`  
**Master manifest:** `public/silos/mtg/silo.json`  
**Machine contract:** `public/silos/mtg/marketplace-contract.json`

## Decision

DreamLedger should evolve the existing MTG silo into a collection-first marketplace, not fork a second commerce backend. Keep the existing DreamLedger catalogue, account, commerce, evidence, CUBE and Gauntlet systems as the system of record. The MTG master template owns the product-specific presentation and policy; it must not create a parallel ledger, payment truth source, customer identity store, or job queue.

The current storefront and manifest are a useful shell, but the silo is **not certified production-complete**. Existing catalogue entries include message-based purchase paths, a known price/checkout mismatch, and unverified diagnostic fulfillment. The current catalogue also still has the legacy Commander diagnostic Payment Link on `main`. Those blockers must be resolved and verified independently before declaring the commercial path ready.

## Product surface

1. **Collection profile and visual grid.** Users may create a collection even when no card is for sale. Every card/printing has explicit visibility and availability: private, visible-but-not-tradeable, tradeable, for sale, or wanted. Private is the default. Collection ownership is user-asserted unless independently verified; never label it verified merely because it was imported.
2. **Import and export.** Start with client-side CSV import/export. Preserve exact printing where present (Scryfall ID, set code, collector number), quantity, finish, language and condition. Preview row-level issues and counts before commit. Do not upload a raw collection file to third-party services without a clear opt-in. Do not scrape Moxfield behind bot protection or rely on an undocumented private API.
3. **Wanted lists and matching.** Match wanted printings against explicitly tradeable inventory only. Do not reveal private or not-for-trade holdings through search, counts, autocomplete, API responses, or error messages.
4. **Listing, offer and trade.** Separate collection records from listings. A listing is an explicit offer with seller, price/currency or trade terms, condition, language/finish, quantity, shipping/meetup terms, timestamps and lifecycle state. Offers and multi-card trades require both parties to accept. Availability changes must be concurrency-safe and idempotent.
5. **Free auctions.** No platform listing fee or platform bid fee for the basic auction. Auction terms disclose end time/time zone, minimum bid/increment, shipping, reserve if any, payment deadline, cancellation rules and what happens when the winner does not pay. Enforce authenticated unique bidders, server-side bid ordering, append-only bid history, and race-safe closing. Anti-shill and abuse handling are launch requirements. "Free auction" does not mean payment processing or shipping is free.
6. **Optional monetisation.** Featured listings, clearly labelled sponsored billboards, cosmetic avatars/profile frames, shop themes and optional seller tools. No pay-to-list requirement. Never sell ranking that looks organic without a sponsored label. No paid placement may promise views, buyers, or sales.
7. **Trust and fulfilment.** Record agreed terms, timestamps, transaction state and disputes. A completed sale is not verified revenue until independent settlement, correct attribution, fulfillment and delivery evidence are joined in the canonical ledger. A listing, bid, checkout start, webhook receipt, or self-report alone is not revenue proof.

## Upstream repository review

Reviewed public repository metadata and READMEs on 2026-10-14. These are candidate components/pattern references, not dependencies already installed in DreamLedger.

| Repository | Potential reuse | License / decision |
|---|---|---|
| [StepKie/MtgCsvHelper](https://github.com/StepKie/MtgCsvHelper) | CSV format conversion and import edge cases; Apache-2.0 reported by GitHub. Its implementation is a Blazor/C# app, so porting behavior is more practical than embedding the whole app in the current web shell. Preserve attribution and license notices if code is reused. | Best first candidate for a license-compatible import investigation. No code has been copied by this contract. |
| [cfbender/manavault](https://github.com/cfbender/manavault) | Local-first collection, exact printings, trade binders, wishlist and import/export concepts. | MPL-2.0 reported by GitHub. Evaluate file-level obligations and stack fit before any code reuse. Not integrated. |
| [KyleDerZweite/spellbook](https://github.com/KyleDerZweite/spellbook) | Inventory, scanning and search concepts. | AGPL-3.0 reported by GitHub. Do not embed or modify for the hosted DreamLedger service without an explicit compliance decision. Not integrated. |
| [pnz1990/mtg-collection-viewer](https://github.com/pnz1990/mtg-collection-viewer) | Visual collection grid, trade calculator and wishlist interaction concepts. | GitHub did not report a license in the repository metadata checked. Treat as **all rights reserved** unless a valid license is found; do not copy code. |
| [McDandle/local-mtg-scanner](https://github.com/McDandle/local-mtg-scanner) | Mobile scanning and local-first collection workflow concepts. | GitHub reported `NOASSERTION`, not a usable license grant. Do not copy code unless the repository owner supplies a clear license. |

Use Scryfall's documented public card data/images where appropriate, respect its usage guidance, and cache responsibly. Do not hotlink or redistribute card images in ways that violate source terms. Card art and Magic trademarks belong to their respective rights holders; DreamLedger is an independent community marketplace and must not imply endorsement.

## Clone contract

Clone only the shell, policies and capability references. Do not copy live product rows, seller identities, user collections, orders, bids, payment links, analytics identifiers, promo inventory, secrets, or evidence artifacts. Every clone gets:
- unique slug, route, manifest and empty catalogue;
- isolated identity/data/analytics/checkout/promotion namespaces;
- explicit feature-status values so planned capabilities cannot be presented as live;
- schema validation, link checks, security/privacy checks and a generated readiness report;
- human approval before public activation or distribution.

A green schema check is not a production-readiness certification. Production readiness also requires end-to-end browser tests against the deployed build and the relevant real payment/fulfillment paths, with no live purchase required for ordinary structural tests.

## Release gates

### Gate A: storefront and catalogue truth
- Resolve all price versus checkout mismatches.
- Every purchasable product has one canonical checkout route and matching SKU/price/currency.
- Unavailable or unverified products are not rendered as purchasable.
- The public catalogue, canonical payment link and production deployment agree.
- The existing Commander diagnostic Gate 1 configuration failure is fixed privately and then tested with a fake/nonexistent session. This must not be described as a successful payment test.

### Gate B: collection MVP
- Import CSV in-browser with preview, row-level errors, exact-printing preservation, duplicate-safe merge and export.
- Collection grid supports private/public visibility and independent trade/sale availability.
- Server-side authorization protects private collections and all write actions.
- Wanted-list matching only exposes explicitly available items.
- Automated tests cover privacy leaks, malformed imports, duplicate imports and exact printing identity.

### Gate C: transaction MVP
- Listings, offers, trade requests and acceptance are idempotent and auditable.
- No listing can be sold/traded twice due to concurrent requests.
- Auction state transitions and bids are server-validated and race-safe.
- Payment and shipping responsibilities are explicit; no hidden escrow/custody.
- Abuse reports, blocked users, dispute states and audit history exist before public auctions launch.

### Gate D: monetisation
- Free core remains usable.
- Featured placement and billboards have inventory reservation, expiry, payment attribution, moderation and a clearly labelled sponsored state.
- Cosmetic entitlements are granted only after verified settlement and can be reconciled/revoked.
- No checkout is enabled for an offer whose fulfillment path is not ready.

### Gate E: clone certification
- Clone starts with empty catalogue and zero inherited customers/orders.
- CI validates manifest, routes, capability status, privacy boundaries, checkout isolation and no-secret/no-inventory-copy rules.
- A clone is deployable in isolation and quarantines on a failed gate.
- CUBE/Gauntlet produces a durable report with commit, artifact hashes, test results and explicit blockers.
- Human gate remains required for deployment, public promotion and any irreversible or money-moving action.

## Economic validation

First validation target is not thousands of users. It is a small cohort completing a real useful action:
1. 3-5 collectors successfully import or build a collection grid.
2. At least one wanted-list match or trade request is accepted.
3. At least one seller creates an accurate listing.
4. One independent buyer completes a real transaction and fulfillment evidence is recorded.
5. Only then test optional promotion or cosmetics.

Measure import completion, collection shares, wanted matches, qualified enquiries, accepted offers, settled sales, fulfilled orders, repeat use, support burden and net contribution after payment/refund costs. Registrations and page views are not economic validation.

## Current status

This change adds a machine-readable product contract and a validator to prevent architectural drift. It does **not** implement collection storage, auctions, payments, imports, production deployment, or buyer demand. Those are explicit follow-on implementation gates, not assumed capabilities.
