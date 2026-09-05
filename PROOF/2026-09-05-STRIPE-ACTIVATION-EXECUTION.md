# Stripe Activation Execution

Date: 2026-09-05

## Action

Canonical DreamLedger founding billboard checkout was activated in Stripe livemode after explicit operator instruction to move the system toward a real economic event.

## Canonical identifiers

- Stripe account: acct_1NKPLaJt4ieIQDFz
- Payment Link: plink_1UCAwDJt4ieIQDFzcWIM4Js3
- Payment URL: https://buy.stripe.com/dRm4gA6AU62KdWUbTi9oc0x
- Price: price_1UCArkJt4ieIQDFz5CYKDipp
- SKU: DL-BILLBOARD-100X100-3000-001
- Amount: NZ$50 one-time
- Currency: NZD

## Observed after activation

- Stripe Payment Link active: true
- Supabase revenue_orders: 0
- Supabase billboard_completion_proofs: 0
- RA_000001: NOT VERIFIED

## Integrity rule

Activation is not counted as revenue. No customer, payment, or completion proof is claimed until a real paid checkout is observed by the deployed webhook and recorded in Supabase.

## Next proof condition

A real stranger payment must produce:

checkout.session.completed -> verified webhook -> revenue order -> entitlement -> published placement -> completion proof

## Repository change

The compiled DreamLedger billboard surface now exposes the canonical Stripe founding-tile checkout directly.
