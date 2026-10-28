# BECK universal marketplace: B2B + P2P + A2A + NZ/Global auction lanes

Status: REVIEW BRANCH. No live auction launch, no Stripe change, no payment, no user auction accepted. Strictly reuse DreamLedger/CUBE marketplace, Gauntlet, Elohim, existing CI and Neon candidate infrastructure.

## What already exists (inspected 2026-10-28)
- B2B/RFQ/search/order routes, a marketplace commerce runtime and contract.
- A2A agent discovery/quote and authority-gate schema under data/schema/a2a-marketplace-v1.json.
- BEC-PRIME/auction-engine.js, public/auctions.html and real inventory concepts.
- A 30-minute GitHub Marketplace Integrity workflow that detects unsafe auction behavior and creates *draft-only* bounded repair PRs. It does not produce real buyers or independently prove payment.
- Existing MarketplaceCommerce uses local JSON locks and user sessions; not a globally safe multi-host auction executor.
- Existing fees in BEC-PRIME/lib/marketplacePolicy.js: 0% for defined free silos and 5% for generic external sellers. That deployed legacy rule has **not** been changed by this PR.

## Completed safe repair candidate
- Auction engine never rolls expired auctions forward; listing reads cannot mutate persisted data.
- Old sample lots are no longer promoted as live bidding and the page has no browser-local fabricated bidder identity/bid receipt.
- New listings remain private DRAFT, awaiting authenticated seller, rights, lawful jurisdiction, Gauntlet and explicit owner approval.
- Live bidding is refused with AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED until an atomic Neon transaction (no unlocked JSON bids) is independently tested.
- Auction page can display only actual seller-verified, Gauntlet-ALLOW, approved, unexpired **read-only** previews, never a live checkout.
- Test suite checks held bids, expired lots, false approvals, cross-silo attempts, UI absence of fake bids and fee quote invariants.
- Existing half-hour workflow validates and can *propose a reviewable repair*; it never automatically merges, publishes, charges or spends.

## Lane economics (candidate, not publicly advertised tariffs)
| Lane | Base listing platform fee | Platform transaction fee | Notes |
|---|---:|---:|---|
| B2B businesses | NZ$0 | 0% | Free discovery/listing/RFQ, monetize separately approved vendor tools, normalized quote comparisons and optional enterprise automation |
| P2P (individual sellers and buyers) | NZ$0 | 0% | Preserve existing peer zero-success-fee contract; payment processor costs are not zero |
| A2A (machine agents) | NZ$0 | proposed 1%, capped at NZ$5 per transaction | Quote only, not a live payment product; authorization, metering, entitlement, caller identity and dispute handling are pending |

Global buyers/sellers may discover proposals with country metadata, but only NZD quotes are currently representable by the **candidate** fee contract. FX, taxes, customs, cross-border payouts, KYC, fraud screening, banned categories, shipping and required dispute rules are explicitly HOLD until supported. Zero *platform fee* is not a promise of zero processing, payout or tax costs.

## Law and trust gates
- NZ Commerce Commission: seller in-trade disclosure and accurate material conditions; intermediaries must take reasonable steps on in-trade status. Shill bidding is prohibited except narrow qualified vendor-bid cases; reject all vendor/self bidding at launch.
- Online timed bids are not the same as auctioneer-led statutory auctions in NZ; obtain appropriate NZ advice before branding a regulated auctioneer service.
- Private sales, trader sales and B2B rights differ. Disclosure and refunds must reflect the actual seller and jurisdiction.
- Use Stripe Connect only after validating NZ and international connected account eligibility, business identity and fees. Do not use a general platform Stripe secret to take customer funds for other sellers; no self-custody, escrow claims, or off-platform Trade Me fee evasion.
- No public activity without explicit owner approval; adult/Amplissa data, MTG inventory, creator assets, customer records and API credentials are strictly separated.

## OSS gap-fill decisions (source and compatibility)
- **Medusa core (MIT)**: https://github.com/medusajs/medusa ; marketplace recipe https://docs.medusajs.com/resources/recipes/marketplace . Potential future adapter for seller-managed products/orders, payment providers, fulfillment and workflow primitives. Needs its own server/PostgreSQL migration; do NOT install it over working BECK infrastructure or create competing purchase authority.
- **Vendure (GPLv3 framework, plugin exception; some B2B features require commercial license)**: https://github.com/vendurehq/vendure ; multivendor guide https://docs.vendure.io/current/framework/how-to/multi-vendor-marketplaces . Official example omits some production needs, including real payments and email verification. Evaluate license/feature constraints before adoption.
- Both are commerce platforms, **not** a drop-in verified auction executor. Reuse existing BECK policy, observability and Neon commerce outbox first. Only introduce a library after measuring a *specific* missing capability and passing isolated license/security/adapter tests.

## Promotion and economic gating
1. Candidate auction and cross-lane tests green on GitHub. Proof artifact from workflow; PC off.
2. Validated seller onboarding, trader status, rights, category controls and per-silo ownership.
3. Neon SERIALIZABLE/row-locked atomic bid transaction with verified bidder, self-bid prevention, increment, reserve, anti-sniping, idempotency, no resurrected lots.
4. Stripe Connect seller onboarding, quote/P2P/B2B fee contract and live payment-safe outbox with idempotent fulfillment. Reconcile old Supabase source before provider cutover; do not assume empty Neon is live.
5. One real qualified buyer and independent seller, actual payment, delivery, resolution of any exception and net margin proof.
6. Controlled public and marketing approval, then progressive release with rollbacks.

Automation can analyze inputs, propose fixes, run tests and open draft PRs. It cannot give itself publishing, payout, new price, public marketplace registration or payment powers. No paid buyer has yet been proven by these engineering changes.
