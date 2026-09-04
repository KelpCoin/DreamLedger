# Next-sale playbook

## Live evidence

As of 2026-09-04, the canonical DreamLedger Stripe account is live and the canonical Founding Tile payment link is active. Live Checkout Sessions show checkout intent but no completed paid session for the canonical NZ$50 link.

## Objective

Convert the next qualified visitor from checkout intent to a paid transaction without inventing revenue or contacting buyers automatically.

## Primary experiment

Offer: Commander Deck Diagnostic
Price: NZ$29 once
Checkout: https://buy.stripe.com/8x28wQ0cwbn48CA3mM9oc00

Deliverable: one-page report containing three biggest issues, five cut candidates with reasons, five add candidates with reasons, one play-pattern issue and fix, and budget alternatives.

## Secondary experiment

Offer: DreamLedger Founding Tile
Price: NZ$50 once
Checkout: https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02

Deliverable: one 100x100 public board placement with one label and one destination URL, subject to review.

## Measurement

Count only these states:

1. Surface: offer and checkout exist.
2. Intent: Checkout Session exists but is not paid.
3. Transaction: Stripe reports a paid Checkout Session tied to the canonical offer/payment link.
4. Fulfillment: paid event is recorded and delivery evidence exists.

Never upgrade one state into another without evidence.

## Human conversion action

Use existing legitimate distribution channels to place the direct-purchase URL in front of qualified prospects. Do not scrape or expose private buyer information, and do not contact abandoned-checkout users automatically.

## Success event

One genuine attributable paid Checkout Session. This becomes RA_000001 when independently reconciled and fulfilled.
