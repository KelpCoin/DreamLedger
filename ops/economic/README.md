# DreamLedger economic operating loop

The economic control plane is now split into four evidence classes:

1. **Surface**: public offer and live checkout exist.
2. **Intent**: a live Stripe checkout session exists but is not paid.
3. **Transaction**: Stripe reports a paid Checkout Session on the canonical offer/link.
4. **Fulfilment**: the paid event is recorded, the offer-specific fulfilment path is completed, and delivery evidence exists.

The system must never upgrade an earlier class into a later class without evidence.

Current paid-state target: one first verified paid session.

Primary offer: DreamLedger Founding Tile, NZ$50 once.

Primary checkout: https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02

Secondary lower-friction offer: Commander Deck Diagnostic, NZ$29 once.

Secondary checkout: https://buy.stripe.com/8x28wQ0cwbn48CA3mM9oc00

Automation:
- `economic-loop.yml` reconciles live payments and creates offer-specific fulfilment work items only after payment evidence.
- `checkout-intent-loop.yml` detects recent unpaid checkout activity and creates an idempotent human conversion signal.
- `beck-production-heartbeat.yml` monitors production health, version convergence, Founding Tile offer availability, and checkout reachability.
