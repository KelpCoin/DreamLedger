# DreamLedger Billboard Cash Lane

This directory defines the NZ$29 Billboard offer as a separate commercial surface.

## Canonical offer

- Offer ID: DREAMLEDGER-BILLBOARD-100X100-NZD29
- SKU: DL-BILLBOARD-100X100-001
- Price: NZ$29
- Checkout: durable Stripe Payment Link recorded in billboard-offer.json

## State boundary

The code in this branch does not claim a payment has occurred.

Payment proof requires an independently verified external Stripe event. Publication requires the paid state, required customer assets, asset validation, and human approval.

## Scope

This patch does not modify:

- CUBE main
- BEC Prime
- UPF runtime
- existing Commander diagnostic checkout

It creates a dedicated Billboard surface so the public offer identity and checkout destination cannot be confused with the existing $15 diagnostic.
