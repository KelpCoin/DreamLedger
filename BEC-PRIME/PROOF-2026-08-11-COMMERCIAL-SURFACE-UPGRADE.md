# DreamLedger Commercial Surface Upgrade

Date: 2026-08-11

## Verified repository state

Repository: `KelpCoin/DreamLedger`
Branch: `main`

## Changes compiled into the public surface

1. Replaced the generic compiled homepage with a stronger compiler-oriented commercial surface.
2. The homepage now exposes the canonical offer engine, commerce spine, proof gates, service health, and offer API.
3. The public marketplace now consumes `/api/offers` rather than presenting a disconnected product-only surface.
4. Checkout buttons remain disabled whenever the canonical offer is approval-gated.
5. Added `Activate-FirstRevenue.ps1`, a fail-closed activation gate that runs the revenue-ledger smoke test, Gauntlet, and registry verifier before enabling the approved $15 NZD Commander Deck Diagnostic SKU.
6. Added `npm run activate:first-revenue` to make the activation path reproducible rather than requiring manual JSON edits.

## Money truth

No revenue is claimed by this artifact.

The activation script only makes the first approved SKU checkout-eligible after the required verification gates pass. Actual revenue remains unproven until Stripe produces a signed `checkout.session.completed` event and DreamLedger writes `FIRST_PAYMENT_PROOF.json`.

## Guardrail

The system remains fail-closed. Architecture is not treated as commercial proof. A successful compiler run is not treated as revenue. The first payment fossil is the required transition from engineered system to verified business activity.
