# DreamLedger

DreamLedger is a focused commerce surface backed by the BEC Prime evidence workflow.

## Current Billboard offer

- Offer: Permanent Digital Billboard Block
- Size: 100x100
- Price: NZ$29
- Checkout: https://buy.stripe.com/28EcN54zraG13M3g3idwc1t
- Required inputs after payment: image and destination URL
- Publication: human review and approval required

The Billboard offer is a separate commercial surface. This README does not claim that any payment has occurred.

## Existing Commander diagnostic

- Product: Commander Deck Diagnostic
- Historical/reference price: NZ$15
- Inputs: Commander deck list, including Moxfield or Archidekt links
- Output: practical diagnostic covering power level, weaknesses, strategy, consistency, and upgrade options

## Correct Render service

- Service name: DreamLedger 1
- Service ID: SRV-D8UD55LCKFVC73F1T4EG
- Service type: Web Service
- Repository: KelpCoin/DreamLedger
- Branch: main
- Public domain: DreamLedger.org

The repository includes a real Node web server. It binds to `0.0.0.0` and uses Render's `PORT` environment variable. The intended start command is `npm start` and the default Node entrypoint `index.js` also loads the same server.

Health endpoint: `/healthz`

## Proof layer

The public proof artifact is `/proof-2026-08-10.html`.

The current BEC Prime smoke-test fixture is:

- Silo: CUBE-01-MTG
- Item: Palinchron - Urza's Legacy Foil
- SKU: MTG-URZAS-LEGACY-PALINCHRON-FOIL-001
- Status: PASS

This is an engine/storefront fixture. It does not claim transaction-level cryptographic proof without a corresponding transaction record.

## Deployment verification

After Render deploys main, verify:

1. `GET /` returns the DreamLedger storefront, not a placeholder page.
2. `GET /healthz` returns JSON with `status: "ok"`.
3. `/proof-2026-08-10.html` loads.
4. `/trust-engine.html` loads and links to the proof artifact.
5. Every purchase CTA loads its intended centralized checkout destination.
6. The custom domain DreamLedger.org resolves to the intended production service.

These deployment and domain checks cannot be guaranteed by GitHub code alone.
