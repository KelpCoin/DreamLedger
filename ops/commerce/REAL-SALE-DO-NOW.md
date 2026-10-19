# Real sale path — do now

**Meter:** NZ$0 verified external revenue.

## What is real (in repo)

| SKU | Price | Status | Cell |
|-----|-------|--------|------|
| Founding Billboard Tile | NZ$50 | authorized | `CELL-PHASE1-TILE-50.json` |
| Commander Deck Diagnostic | NZ$29 | authorized | `CELL-PHASE1-DIAG-29.json` |

Bundles at NZ$99 / NZ$129 are **not** sellable until Stripe Payment Links exist.

## What the network says (probe)

- `https://buy.stripe.com/28EcN54zraG13M3g3idwc1t` → **HTTP 200**
- `dreamledger.org/buy/...` and `/billboard` → **HTTP 503**
- `dreamledger.org/` and `/mtg/` → **HTTP 429** at probe time

So: **checkout host works; public domain buy routes do not.** Ball C must use the working Stripe URL until domain routes return 200.

## What is not real

- NZ$299 “Agent Readiness Diagnostic” landing copy not found in this repository
- Any claim of verified revenue
- Automatic price jump to NZ$1,500+ without fossils

## Execution (no new products)

1. **Primary CTA** = Billboard Tile NZ$50 (or Diagnostic NZ$29 on MTG channels).
2. Post **only** on owned channels: Happy Homarid Discord/Patreon, existing Linktree, known MTG contacts. No unsolicited mass DM.
3. Link the **live Stripe checkout** until `dreamledger.org/buy/*` is 200.
4. On first external livemode pay: fulfil → fee evidence join → fossil → then meter moves.
5. BECK settlement join stays fail-closed; production webhook fee wiring still needs explicit auth.

## Success

One independent buyer pays, receives the deliverable, evidence chain closes. That is “make it real.” Everything else is support.
