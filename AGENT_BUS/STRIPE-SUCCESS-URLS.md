# Stripe success / cancel URL map (operator)

Wire these in Stripe Payment Links or Checkout so paid work can be fulfilled.

## Commander diagnostic · COMMANDER-DECK-DIAGNOSTIC-001
- **Success:** `https://dreamledger.org/diagnostic-input.html?session_id={CHECKOUT_SESSION_ID}`
- **Cancel:** `https://dreamledger.org/mtg`
- **Fulfillment UI:** `/diagnostic-input.html` → `POST /api/commercial/input`

## Seller profit audit · SELLER-PROFIT-AUDIT-001
- **Success:** `https://dreamledger.org/seller-audit-input.html?session_id={CHECKOUT_SESSION_ID}`
- **Cancel:** `https://dreamledger.org/money.html` or `/`
- **Fulfillment UI:** `/seller-audit-input.html`

## Sprout / merch / billboard
- **Success:** `https://dreamledger.org/?paid=1` (or product-specific thank-you when built)
- Digital merch may need separate fulfill paths later

## Rules
- Always pass `client_reference_id` = product_id (buy router already does this on `/buy/{id}`)
- Revenue only after Stripe paid + delivery done
- If Payment Link UI does not support `{CHECKOUT_SESSION_ID}`, use Stripe Checkout Session API or manual paste of `cs_` on intake form

## Live buy routers (2026-10-02)
- https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001
- https://dreamledger.org/buy/SELLER-PROFIT-AUDIT-001
