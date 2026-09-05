# Autonomous Revenue Engine Proof

Date: 2026-09-05

## Scope

Implemented the first reusable payment-to-entitlement spine for DreamLedger/BEC economic services.

## Stripe

Account: acct_1NKPLaJt4ieIQDFz (live mode)

Created 20 one-time Stripe products/prices with stable SKU metadata AUT_0001 through AUT_0020.
Created 20 active Payment Links.
Payment Links carry `sku_id` metadata and redirect after checkout to `/fulfilment.html?session_id={CHECKOUT_SESSION_ID}`.

Webhook endpoint:
`https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/stripe-revenue-41104f355d6878cdd6d1f9dc`

Event: `checkout.session.completed`

## Supabase

Project: DreamLedger / `wbwgroygjeyukkspnqiy`

Tables added:
- `revenue_catalog`: SKU, price, Stripe IDs, payment link, lane, fulfillment type
- `revenue_orders`: immutable paid-order record keyed by Stripe event/session
- `revenue_entitlements`: one bearer fulfillment key per paid order
- `fulfillment_requests`: customer-submitted fulfillment payloads tied to an entitlement

RLS is enabled on all four tables. Customer-facing direct table access is revoked; public access goes through controlled edge functions.

## Edge Functions

`stripe-revenue-41104f355d6878cdd6d1f9dc`
- Verifies Stripe webhook signatures.
- Accepts `checkout.session.completed`.
- Reads `sku_id` from checkout metadata.
- Records the paid order idempotently by Stripe event ID.
- Generates a unique `DL-<SKU>-<TOKEN>` fulfillment key.
- Creates the entitlement.

`revenue-redeem-41104f355d6878cdd6d1f9dc`
- Looks up a paid entitlement by checkout session ID or fulfillment key.
- Returns the entitlement state and key without exposing database credentials.

`revenue-submit-41104f355d6878cdd6d1f9dc`
- Accepts the fulfillment key plus customer/service material.
- Validates that the key maps to a paid entitlement.
- Queues the fulfillment request in `fulfillment_requests`.

## Web

Added `public/fulfilment.html`.
Added `public/offers.html`.
Updated `public/automation-rescue.html` to use the live NZ$99 Payment Link and link to the full offer catalog.

## Economic state

The payment rail now exists.
The entitlement wall now exists.
The fulfillment request queue now exists.

A real customer payment is still required to produce the first observed entitlement and therefore RA_000001. No test payment was fabricated.

## Remaining human gate

Acquire a real buyer and complete a live payment. That event will exercise:

STRANGER -> OFFER -> STRIPE PAYMENT -> WEBHOOK -> ORDER -> ENTITLEMENT KEY -> FULFILMENT WALL -> REQUEST

The current implementation establishes the commerce plumbing. Full autonomous execution of each service still requires service-specific worker implementations and verification policies; those are intentionally not claimed as complete by this proof.
