# Aotearoa MTG Exchange: Cloud Elohim release contract

Status: DRAFT / HUMAN APPROVAL REQUIRED / NOT LIVE.
Scope: existing DreamLedger MTG master silo only. No new payment provider, parallel user database, or duplicate commerce kernel.

## Staged code

- MTG homepage links to the visual exchange, diagnostic, Patreon and both supplied Discord communities.
- Responsive grid/list Commander catalogue uses both the MTG feed and independent global catalogue. It suppresses inconsistencies instead of implying sellable inventory.
- Browser-local private have/want trade binder and JSON export, with zero platform commission. There is no active trade matching service.
- Free Quintorius Commander diagnostic reads the genuine site decklist, requests card metadata from Scryfall in bounded batches, and returns PASS, QUARANTINE or FAIL based on explicit land, average mana value and simple Spirit/graveyard indicators. Missing metadata always quarantines. This is not a tournament or legality checker.
- Email address is currently validated ONLY IN THE BROWSER. No email is sent, stored or uploaded; users may download or print the one-page report or prepare a manual email draft. A delivered under-60-second email remains a future acceptance test, not a production claim.
- Source-linked manually reviewed ticker. NOT live automated breaking news. No fake sponsored cards or price data.
- Avatar entry reuses the existing DreamMeez browser identity. Cross-site persistent account sync remains unverified.
- Existing auction and B2B paths linked, but live bidding and settlement remain held.
- Optional sponsored visibility starts as an enquiry only. It never influences ordinary search results at this stage.

## Cloud-first Elohim refinement design

1. Collect only permitted public/partner data from MTGStocks, TCGplayer, NZ specialists, Wizards announcements, Scryfall and deck-community exports. No logged-in scraping. TCGplayer does not grant new API access as of October 2026.
2. Normalize exact card, set, finish, condition, location, currency, timestamps, permissions and source URLs to the existing evidence lake. Preserve source and freshness and deduplicate.
3. Cloud Elohim generates candidates for user-facing trends, support articles, usability fixes, tiering and merchandising. It must never auto-copy third-party code, interface designs or copyrighted writing.
4. Existing Gauntlet verifies provenance, user value, cross-silo isolation, privacy, price truth, RLS, license and non-manipulative sponsorship. Failed or missing evidence stays QUARANTINE.
5. Submit a reviewable PR to the existing CUBE and CI system. No external posting, public deploy or paid activation until separate owner approval.
6. Measure completed user journeys, live order receipts, source freshness, performance, safety incidents and real paid-and-delivered orders. Feed observations into Elohim on a capped daily iteration schedule with cost and rate limits.

## Cloud production blockers

- Verified identity, persistent peer listings, moderated trade matching and a documented dispute/reporting flow.
- Transactional durable auctions with shill prevention, seller verification, real clocks, idempotent bids, antisniping and reserve settlement.
- Stripe Connect seller onboarding, jurisdiction support and actual zero platform application fees. Processing fees remain paid to Stripe under the applicable arrangement.
- Cross-domain avatars with opt-in scope, no implicit sharing of personal data and no unrelated silo payloads.
- Moderated automatic news ingestion from licensed/approved feeds, provenance and freshness controls, and human release approval for public items.
- Email provider, queue, anti-abuse rate limits, consent notices, proof of delivery and measured under-60-second SLA.
- Compliance with New Zealand consumer law, trader disclosure and overseas market restrictions.
- Dedicated performance, accessibility and end-to-end beta tests before claims of world-leading quality.

## Exact verifier commands

From the repository root on the review branch:
node scripts/verify-mtg-exchange-worldwide.cjs
node scripts/verify-beck-mtg-clone-gate.cjs
node scripts/test-beck-mtg-master-hardening.cjs

The first command writes artifacts/mtg-exchange-proof.json, including SHA-256 input hashes and honest HOLD fields. The existing clone command is not a substitute for remote RLS, zero-inventory, rollback or publication proofs.

Only after approved deployment:
curl -I https://dreamledger.org/mtg/
curl -I https://dreamledger.org/mtg/quintorius-field-historian.html
curl -I https://dreamledger.org/mtg/diagnostic/
curl -I https://dreamledger.org/mtg/exchange.html

HTTP 200 alone does not prove the content, data-plane health or email delivery. QR target must be verified by scanning the real printed code without changing the canonical immutable QR.

## Fair Trading Act public line

No claim of inventory availability or tournament performance is made without verified evidence.
