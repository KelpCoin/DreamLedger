# DreamLedger Production Surface Proof

Date: 2026-08-11
Repository: KelpCoin/DreamLedger

## Changes in this deployment set

- Replaced the neutral root surface with an enterprise-style DreamLedger storefront.
- Added a horizontal live catalog rail backed by GET /api/products.
- Added server checkout invocation from the storefront using product_id and silo only.
- Added the first five public category surfaces:
  - /commander
  - /pokemon
  - /vinyl
  - /videogames
  - /retro
- Added canonical silo manifests under BEC-PRIME/catalog/silos/.
- Added Dreamies identity treatment and the Calpalantis coming-soon surface.
- Expanded Render build validation to syntax-check server.js and verify all five category pages plus the live MTG page and canonical SKU.
- Removed two accidental probe files created during repository inspection.

## Existing commerce gates confirmed from repository

- BEC-PRIME/server.js is the active commerce server.
- Stripe is called directly over HTTPS using STRIPE_SECRET_KEY.
- Checkout pricing is read from the canonical product record.
- POST /api/checkout/create exists.
- POST /webhook exists with Stripe signature verification.
- Transaction recording is idempotent by Stripe session ID.
- Transaction proof files are generated after paid checkout webhook confirmation.
- /healthz and product API endpoints exist.
- The canonical Palinchron SKU exists and is published at NZD 700 with inventory 1.

## Runtime gates intentionally not claimed as PASS here

- Render environment variables must be present at runtime.
- Stripe webhook registration must point at https://dreamledger.org/webhook.
- A real Stripe test checkout must complete successfully.
- The webhook must create a transaction record and proof.
- Durable production ledger storage must be configured rather than relying on an ephemeral filesystem.

## Verification command

PowerShell 5.1 local verifier:

    git fetch origin main
    git show origin/main:BEC-PRIME/server.js | Select-String "checkout/sessions|/webhook|/healthz"
    git show origin/main:BEC-PRIME/render.yaml
    git ls-tree -r --name-only origin/main BEC-PRIME/compiled/website | Select-String "^(BEC-PRIME/compiled/website/(index|mtg/index|commander/index|pokemon/index|vinyl/index|videogames/index|retro/index)\.html)$"

## Truth rule

Code presence is not treated as proof of a live money transaction. A transaction is PASS only after Stripe checkout completion, webhook receipt, transaction record creation, and proof creation are observed.
