# Cash-First Storefront Release Proof

Date: 2026-08-28 NZ
Repository: KelpCoin/DreamLedger
Branch: main

## Completed

1. Public surface source changed from architecture-first presentation to a product-first catalogue.
2. Public catalogue uses a horizontal scrolling product rail and explicitly separates LIVE, TEST and COMING SOON surfaces.
3. MTG catalogue is now horizontally scrollable on mobile and desktop.
4. MTG BUY buttons now call the live checkout route.
5. EDH_0001 remains published inventory with one physical unit and NZ$400 pricing.
6. EDH_0001's existing approved Stripe Payment Link is used as a cash-first checkout fallback when server-side Stripe API credentials are not present.
7. Render runtime now loads the existing live route compatibility layer so /api/checkout/create maps to the canonical offer checkout handler.
8. Render Blueprint now runs the full BEC-PRIME production build compiler instead of only installing dependencies.
9. Render Blueprint retains the existing custom domains, persistent proof/ledger disk and secret environment variables.
10. Repository root package.json was restored unchanged; the Render deployment uses BEC-PRIME/package.json because render.yaml sets rootDir to BEC-PRIME.

## Evidence

EDH_0001 source record: BEC-PRIME/catalog/products/EDH_0001.json
MTG source surface: BEC-PRIME/website/mtg-catalog.html
Public catalogue source: BEC-PRIME/surface/catalog.html
Render deployment contract: render.yaml
Render runtime package: BEC-PRIME/package.json
Checkout runtime: BEC-PRIME/routes/platformCart.js
Route compatibility: BEC-PRIME/lib/liveRouteCompatibility.js

## Acceptance path

https://dreamledger.org/
https://dreamledger.org/mtg
/api/products
/api/checkout/create
Stripe checkout
Stripe webhook
Durable payment proof

## Current economic truth

REVENUE_PROVEN_NZD = 0
CUSTOMERS_PROVEN = 0
SETTLEMENTS_PROVEN = 0
GATE = ONE_INDEPENDENT_EXTERNAL_PAYMENT

This proof does not claim a deployment succeeded or a payment occurred. The GitHub changes are committed. Render deployment status must be checked in the Render Dashboard or through an authorized Render API session.

## Verification commands

60-second public checks:

curl.exe -I https://dreamledger.org/
curl.exe -I https://dreamledger.org/mtg
curl.exe https://dreamledger.org/api/products
curl.exe https://dreamledger.org/healthz

Checkout configuration check:

curl.exe -X POST https://dreamledger.org/api/checkout/create -H "Content-Type: application/json" -d "{\"offer_id\":\"EDH_0001\",\"product_id\":\"EDH_0001\",\"silo\":\"mtg\"}"

Do not complete a purchase unless the goal is to create the first independent settlement.
