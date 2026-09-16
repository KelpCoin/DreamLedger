# Demand ≠ Intent to pay ≠ Revenue

## Definitions (canonical)

| Signal | What it is | What it is NOT | How we measure |
|--------|------------|----------------|----------------|
| **Demand** | Attention / conversation / search volume | Willingness to pay | Reddit/HN/SO/GitHub counts, Substack topics, radar score |
| **Intent to pay** | Started checkout OR explicit “I will pay for X” | Revenue | Stripe Checkout Session created unpaid; typed buy language with price |
| **Supply** | Inventory we can fulfil this week | Wishlist | Owned units, service capacity hours, finite billboard coords |
| **Revenue** | Settled Stripe payment + fulfilment evidence | Clicks | `payment_intent.succeeded` / session paid + ledger row |

Never promote demand scores into revenue. Never treat unpaid checkout as a sale.

## MVP money order (execute in this order)

1. **Supply check** — what can we fulfil in 48h?
   - Billboard founding tiles (finite coords)
   - Commander Diagnostic capacity (manual hours)
   - EDH_0001 (1 physical unit)
   - Discord webhook kit (digital, high capacity)
2. **Intent capture** — lowest friction paid path first
   - NZ$29 Diagnostic (service)
   - NZ$50 Tile (scarce placement)
   - NZ$1 curiosity pack if present on /mtg
3. **Demand ingestion** — Reddit + Substack + radar for *where* to stand, not fake volume
4. **QR distribution** — one canonical URL with UTM; post only where allowed

## Intent ranking (higher = closer to money)

1. Stripe checkout started, not paid (same product, last 7 days)
2. Explicit “pay / buy / invoice me” with budget in public thread
3. Repeat visitor + product page + outbound to `buy.stripe.com`
4. Generic “looking for deck help” with no price language (demand only)

## Human conversion rule

From `ops/economic/CHECKOUT-INTENT-PLAYBOOK.md`: when unpaid checkout intent appears, prioritise that offer in a **public** channel or existing relationship. Do not scrape private Stripe PII for cold outreach.
