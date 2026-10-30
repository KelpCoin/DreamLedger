# MTG Master Silo + NZ TCG Home: release acceptance contract
Date: 2026-10-30
Branch: beck/mtg-edh8020-configurator-20261030
PR: https://github.com/KelpCoin/DreamLedger/pull/903
Release status: HOLD. This document is not a certificate of production readiness.

## Purpose
Provide one useful New Zealand player journey without claiming unfinished marketplace capabilities:
- DreamLedger QR/home CTA -> /mtg/ for Magic or /tcg/ for other trading-card games
- /mtg/ -> Magic Scryfall listing draft, Commander catalogue previews, and Happy Homarid community
- /tcg/ -> eight game pages and /tcg-list for private NZD listing drafts
- Both listing tools permit local draft save, copy, and JSON export. No automatic publication.
- MTG Master is the reference pattern. Other TCG pages are previews, NOT market-tested clones with copied stock or orders.

## What this branch changes
- Source/public MTG page stays synchronized; introduces the cross-game route and stock-held wording.
- EDH_0001 remains NZD 400, zero verified sellable stock, and checkout held.
- Existing physical deck detail pages no longer promise "1 in stock" where supply attestation is missing.
- Seven other TCG page labels are explicitly previews.
- TCG directory uses safe DOM text nodes and allowlisted game routes; removes unsourced ranking claims from customer copy.
- Universal and Magic-specific drafts include export without backend, credentials, posting or payments.
- Source-level automated test: node scripts/test-tcg-nz-home.cjs
- Existing 80/20 contract: node scripts/test-mtg-8020.cjs
- GitHub Actions proof artifact: mtg-nz-tcg-home-proof, containing artifacts/mtg-nz-tcg-home-proof.json.

## Release blockers (do not bypass)
1. Physically attest each deck: complete 100-card contents if advertised, photos, exact quantity, condition, location, ownership, and packaging.
2. Reconcile the physical inventory authority across product JSON, Airtable and any actual counting record. An Airtable "Listed" state does not prove stock.
3. Establish delivery terms and address-handling privacy, NZ postage price/margins, returns, and physical fulfilment receipts.
4. Verify checkout inventory reservation, payment idempotency, signature-verified Stripe webhooks, duplicate event handling, refunds, and delivery confirmation. Do not activate any existing Stripe link while the product is held.
5. Repair unrelated repository-wide production contract failures without weakening gates. In particular, reconcile an ACTIVE_LIVEMODE Commander diagnostic payment link against its held digital product.
6. Obtain explicit owner approval for a public release. The repository currently has Vercel git.deploymentEnabled false; committed code is NOT deployed by this PR.
7. Run production anonymous browser smoke checks: /mtg/, /tcg/, /tcg-list, /mtg-list, /mtg/customize/, each game page, and public privacy boundaries.
8. Only certify a paid-and-delivered order when an independent buyer, settled payment, delivery evidence, actual costs, and reconciliation are linked.

## Release acceptance
- Focused contract CI PASS with proof file attached.
- Repository-wide required CI PASS; any failures documented and properly repaired.
- Stock and delivery VERIFIED for each separately enabled SKU.
- Public page cannot expose a buy link for a held SKU.
- All static pages load and draft export works on mobile and desktop.
- Owner explicitly authorizes public release.
- Production hash matches approved release SHA.
- No traffic, revenue, order, or customer-count claims without measurement.

## Economics
Verified independent paid-and-delivered orders: 0 in the latest owner-supplied reconciliation.
Conversion and contribution margin: unknown. No tests or drafts change those numbers.
Near-term user value: a zero-cost reusable listing preparation tool. Monetization may be considered after actual buyer demand and safe fulfilment are proven.
