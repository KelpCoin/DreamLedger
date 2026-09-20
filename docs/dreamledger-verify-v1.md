# DreamLedger Verify v1

Status: PROPOSED / NOT PUBLIC

## Commercial question

Will a marketplace, agent operator, or platform pay for an independently verifiable answer to:

"Did this exact order actually settle to the seller?"

## Product

POST /m2m/v1/verify-settlement

Input:
- claim
- evidence.order_id
- optional evidence.amount_minor
- optional evidence.currency

Verification sources:
- marketplace_orders
- marketplace_payments
- marketplace_transfers
- marketplace_fulfillments

Verdicts:
- VERIFIED: paid + seller transfer settled + amounts reconcile
- UNVERIFIED: required independent evidence is missing
- CONTRADICTED: evidence conflicts or records show reversal/failure/refund

The endpoint never treats a supplied claim, Stripe ID, receipt, or seller assertion as proof by itself.

## Commercial rail

Target price: US$0.02 per verification.

Target payment rail: x402 v2.

Current code state: verification endpoint exists in source, but x402 gating is deliberately NOT enabled and the endpoint has NOT been deployed from this change.

## First customer hypothesis

Primary:
- small marketplace
- agent commerce platform
- agent operator handling consequential purchases

Trigger:
They already have a transaction and need an independent party to establish whether the claimed payment/settlement happened.

## Success condition

One external caller pays for one verification and receives a VERIFIED or CONTRADICTED result that the caller considers useful.

## Stop condition

No payment after a bounded acquisition experiment means change the buyer/problem wedge before adding more infrastructure.

## Safety

No fake transactions.
No simulated revenue.
No public publication without approval.
No live financial action without explicit approval.
