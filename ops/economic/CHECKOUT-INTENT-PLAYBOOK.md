# Checkout intent conversion playbook

Purpose: turn verified Stripe checkout behavior into a human-led conversion experiment without inventing revenue or automatically contacting buyers.

## Signal definition

A checkout session tied to an approved DreamLedger payment link and created within the recent observation window is a conversion-intent signal when it is not paid.

This signal is not revenue.

## Current canonical surfaces

- Founding Tile: NZ$50
- Commander Deck Diagnostic: NZ$29

## Human action

When a checkout-intent issue appears, prioritize the corresponding offer for a manual conversion experiment through an appropriate public channel or existing relationship. Do not use private Stripe customer information for unsolicited outreach. Do not claim a conversion until Stripe reports the session as paid and the fulfillment chain records delivery evidence.

## Economic progression

checkout_started -> payment_attempt -> paid -> verified economic event -> fulfillment -> delivery evidence -> learning

The system should optimize for the next observed transition, not for vanity traffic.
