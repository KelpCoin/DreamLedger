---
type: offer_ref
offer_id: OFFER-QUOTE-COMPARE-49-NZD
sku: QUOTE-COMPARE-49
price_nzd: 49
currency: NZD
status: listed
payment_link_url: "https://buy.stripe.com/14AdR97LD6pLfuLdVadwc32"
checkout_aligned: false
---

# Offer: Supplier Quote Comparison

## Deliverable

Normalized comparison of 2–5 supplier quotes into a source-backed decision packet.

## Fulfillment path (catalog)

`stripe_payment → revenue_webhook → revenue_order → entitlement → fulfillment_request → quote_fulfillment → digital_delivery`

Post-pay redirect target on alternate link: `https://dreamledger.org/quote-intake.html?session_id={CHECKOUT_SESSION_ID}`

## Alignment checks

- [ ] Public checkout URL matches the Payment Link that carries `dreamledger_sku: QUOTE-COMPARE-49`
- [ ] Metadata includes fields the webhook resolver needs (`sku_id` / `sku` / `marketplace_listing_id` as required)
- [ ] Webhook → order → entitlement proven on one paid session
- [ ] Fulfillment artifact produced and linked

## Revenue status

**NZ$0.00** verified for this SKU as of 2026-10-10 live scan. This note is not settlement evidence.
