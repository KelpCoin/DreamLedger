# CUBE First Transaction Runbook

Objective: produce the first independently verified CUBE marketplace settlement.

This runbook deliberately separates infrastructure readiness from economic truth.

## Economic truth

A CUBE transaction is VERIFIED only when all of the following exist:

1. A real external buyer initiated the purchase.
2. Stripe reports the payment as settled/paid.
3. The listing and seller identity are attributable to that payment.
4. Fulfilment is recorded.
5. Buyer confirmation is recorded.
6. A proof artifact ties the chain together.

A created Checkout Session is not revenue. A self-payment is not revenue. A test payment is not revenue.

## First-cell sequence

`listing -> buyer -> checkout -> settled payment -> fulfilment -> buyer confirmation -> proof`

The first seller may be the operator. The first buyer must be independent.

## Live verifier

`BEC-PRIME/scripts/Start-CubeFirstTransaction.ps1`

Readiness only:

`powershell -ExecutionPolicy Bypass -File .\BEC-PRIME\scripts\Start-CubeFirstTransaction.ps1`

Create a real Stripe Checkout Session only after a human has approved that external action:

`powershell -ExecutionPolicy Bypass -File .\BEC-PRIME\scripts\Start-CubeFirstTransaction.ps1 -CreateCheckout`

The script writes an ASCII proof JSON file and never labels a payment as revenue merely because checkout creation succeeded.

## Metrics

Record these from the first transaction onward:

- SELLERS_ACTIVE
- SELLERS_WITH_LISTINGS
- SELLERS_WITH_ORDERS
- SELLERS_WITH_SETTLED_PAYMENTS
- BUYERS_ACTIVE
- ORDERS_SETTLED
- GMV_SETTLED
- PLATFORM_REVENUE
- HUMAN_MINUTES_PER_SETTLED_ORDER
- TIME_TO_FIRST_SETTLEMENT
- SECOND_TRANSACTION_RATE_30D_BUYER
- SECOND_TRANSACTION_RATE_30D_SELLER

`HUMAN_MINUTES_PER_SETTLED_ORDER` is measured, not estimated.

`SECOND_TRANSACTION_RATE_30D_*` is a cohort metric. The 30% and 10% figures are operating benchmarks, not laws of nature.

## Stop conditions

Do not build acquisition automation because seller signup counts look good.

Do not count catalog rows as sellers.

Do not count Checkout Session creation as payment.

Do not count internal/operator test money as external revenue.

Do not clone a CUBE cell until its transaction path has real evidence.

## Next economic action after a verified settlement

Use the evidence from the first transaction to recruit the next seller manually. The goal is a second independent seller transaction, not a larger database of untransacted sellers.
