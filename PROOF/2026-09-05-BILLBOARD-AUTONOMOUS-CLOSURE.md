# Billboard Autonomous Closure

Date: 2026-09-05

## Verified in connected systems

- Canonical SKU: `DL-BILLBOARD-100X100-3000-001`
- Price: NZ$50 one-time
- Supabase catalog row exists and remains inactive until production exposure is intentionally opened.
- Supabase now contains an atomic `billboard_publish_paid(...)` transaction function.
- The transaction validates SKU, amount/currency, label bounds, HTTPS destination, and blocks localhost/private-network destinations.
- The transaction acquires the existing billboard advisory lock, creates the revenue order, creates a ready entitlement and fulfillment key, inserts a `PUBLISHED` 100x100 placement, and seals `billboard_completion_proofs` in one database transaction.
- Duplicate checkout sessions are handled idempotently.
- Public execution permission on the security-definer function is revoked; execution is granted to `service_role`.
- The `dreamledger-billboard-webhook` Supabase Edge Function is now version 4 and verifies the raw Stripe webhook body/signature before parsing the event.
- The webhook checks the canonical SKU, paid status, NZD currency, exact NZ$50 amount, and canonical Stripe price before calling the atomic fulfillment transaction.
- Invalid paid inputs are sent to the refund path rather than being silently accepted.
- Stripe live product and price were prepared, and a live Payment Link was created for the exact two required customer fields. The Payment Link is intentionally INACTIVE pending end-to-end production verification.

## Test evidence

- Invalid amount rejection was exercised against the database fulfillment function.
- No test order, entitlement, placement, or completion proof was created by that rejection test.

## Remaining gate

A live stranger payment has NOT occurred. RA_000001 remains NOT VERIFIED.

Before opening the Payment Link to public traffic, verify the deployed webhook environment has `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_URL` configured as secrets/environment values. No webhook secret is stored in this repository proof.

Then run a safe end-to-end test in Stripe test mode or equivalent isolated environment and verify:

`checkout.session.completed -> order -> entitlement -> atomic published placement -> completion proof -> live board visibility`

Only after that gate passes should the live Payment Link be activated and the public billboard surface changed from NOT CURRENTLY FOR SALE to the actual offer.

## Economic state

`UNFULFILLABLE -> substantially closer to FULFILLABLE`

`NZ$0 verified revenue -> NZ$0 verified revenue`

`RA_000001 -> NOT VERIFIED`
