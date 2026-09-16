# Current supply snapshot — 2026-09-17

What we can actually fulfil. Update after each sale.

| SKU | Type | Capacity now | Fulfilment | Checkout |
|-----|------|--------------|------------|----------|
| Founding Billboard Tile | Placement | Finite founding coords (ops must track sold coords) | Human review + publish | Live Stripe NZ$50 |
| Commander Deck Diagnostic | Service | ~5–10 / week manual | Manual write-up | Live NZ$29 |
| EDH_0001 Commander Deck | Physical | **1 unit** | Ship after pay | Live NZ$400 |
| Discord Webhook Starter | Digital | High | Download / guide | Live NZ$79 |
| Palinchron Foil | Collectible | Listed | **Checkout OFF** | Unavailable |
| Maximona IPV | B2B service | Low (scoped) | Manual | Live NZ$1,500 |
| DreamMeez cosmetics | Digital grant | High | Entitlement after pay | Live micro prices |
| Floor 1 access NZ$19 | Access | Limited pass | Grant + client | Live |

## Supply constraints (money-critical)

1. **EDH_0001** — mark sold in catalogue the moment Stripe settles; do not double-sell.
2. **Billboard** — maintain sold-coordinate list; never sell the same tile twice.
3. **Diagnostic** — if queue > 5 open unpaid-fulfilment jobs, pause ads / QR push until clear.

## Competitive supply (external — demand context)

- NZ deck pricing tools (e.g. Deck Scout) = **tooling**, not diagnostic service.
- Reddit “I’ll build your deck for free/hobby” = **substitute supply** for NZ$29 diagnostic; differentiate with **paid, written, structural** deliverable and Stripe receipt.

## Next supply action

- [ ] Confirm EDH_0001 still in hand physically
- [ ] Export list of remaining founding billboard coordinates
- [ ] Set diagnostic WIP limit = 5
