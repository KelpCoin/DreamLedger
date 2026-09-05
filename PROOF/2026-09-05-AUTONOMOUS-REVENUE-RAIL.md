# Autonomous Revenue Rail Proof

Date: 2026-09-05

## Canonical service

- SKU: AUT_0001
- Offer: n8n Automation Rescue
- Price: NZ$99 one-time
- Fulfillment type: service_intake

## Stripe

- Live Product: `prod_VCYuD2mwwxYwmc`
- Live Price: `price_1UC9mvJt4ieIQDFzFeYbBtP1`
- Live Payment Link: `https://buy.stripe.com/6oU9AU0cwezgbOM9La9oc0w`
- Payment Link: active
- Currency: NZD
- Amount: 9900 minor units
- Successful checkout redirects to `/fulfilment.html?session_id={CHECKOUT_SESSION_ID}`
- Payment metadata carries `sku_id=AUT_0001`

## Webhook

- Stripe event: `checkout.session.completed`
- Endpoint: `https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/stripe-revenue-41104f355d6878cdd6d1f9dc`
- Stripe endpoint status: enabled
- Endpoint is configured for the canonical Stripe account
- Webhook handler verifies the Stripe signature, deduplicates by event ID, validates the SKU against the revenue catalog, records the paid order, and creates a fulfillment entitlement key.

## Fulfillment wall

- `/fulfilment.html` accepts the Checkout Session ID after payment.
- `revenue-redeem-41104f355d6878cdd6d1f9dc` resolves the paid order to its entitlement key.
- The wall displays the bearer fulfillment key and exposes the service-intake form.
- `revenue-submit-41104f355d6878cdd6d1f9dc` records the fulfillment request against the paid entitlement.

## Supabase

- Project: DreamLedger
- `public.revenue_catalog`: 20 active catalog rows
- `AUT_0001` is reconciled to the live Stripe product, price, and payment link above.
- `public.revenue_orders`: 0 real orders observed at proof time.
- `public.revenue_entitlements`: 0 real entitlements observed at proof time.

## Truth status

PAYMENT RAIL: CONFIGURED
WEBHOOK RAIL: CONFIGURED
ENTITLEMENT RAIL: CONFIGURED
FULFILLMENT WALL: IMPLEMENTED
REAL CUSTOMER: NOT YET OBSERVED
REAL PAYMENT: NOT YET OBSERVED
RA_000001: OPEN

This proof establishes configuration, not revenue. A real `checkout.session.completed` event from a stranger is still required to close RA_000001.
