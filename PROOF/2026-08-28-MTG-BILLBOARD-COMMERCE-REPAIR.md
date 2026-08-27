# MTG + Billboard Commerce Repair Proof

Date: 2026-08-28 NZ
Repository: KelpCoin/DreamLedger
Branch: main

## Repair

1. EDH_0001 price is now stored as 40000 minor NZD units, representing NZ$400.00.
2. EDH_0001 remains one physical unit and has an approved live Stripe Payment Link.
3. The MTG storefront was replaced with a sales-first catalogue. BUY NOW actions are real links or real checkout API calls.
4. The MTG storefront no longer presents Monte Carlo/Cinema as part of the purchase path.
5. The public catalogue was rebuilt around actual MTG and Billboard commerce lanes.
6. Billboard Founding Tile is explicitly linked to the dedicated Billboard order flow.
7. Billboard Small checkout is aligned to the canonical NZ$50 founding price.
8. Billboard payment remains separate from publication: payment creates an order and human review controls publication.
9. The public catalogue keeps MTG and Billboard economically separated.

## Canonical MTG records currently present

- EDH_0001
- BESPOKE-ARTISAN-EDH-DECK-001
- MTG-URZAS-LEGACY-PALINCHRON-FOIL-001

The repository contains more historical MTG material, but this release only exposes records that exist as canonical product JSON records. No inventory count is fabricated.

## Acceptance path

Public catalogue -> MTG -> product -> BUY NOW -> Stripe payment surface -> signed webhook -> durable ledger -> fulfilment proof.

Public catalogue -> Billboard -> claim space -> dedicated Billboard order -> Stripe checkout -> payment -> human review -> publication -> fulfilment proof.

## Current economic truth

REVENUE_PROVEN_NZD = 0
CUSTOMERS_PROVEN = 0
SETTLEMENTS_PROVEN = 0
GATE = ONE_INDEPENDENT_EXTERNAL_PAYMENT

This proof records code changes only. It does not claim deployment success or a completed payment.

## Production verification

curl.exe -I https://dreamledger.org/
curl.exe -I https://dreamledger.org/mtg
curl.exe -I https://dreamledger.org/billboard
curl.exe https://dreamledger.org/api/products
curl.exe https://dreamledger.org/api/billboard
curl.exe https://dreamledger.org/healthz
