# resolver.eventregret.v1 intake contract

Product: Should I Still Go
Price: NZ$5.00

## Fulfillment
This SKU is static. A confirmed paid order receives the canonical decision-pack deliverable.

## Economic truth
A checkout click, payment link, screenshot, email claim, or internal record is not revenue. Revenue requires an externally settled payment, attribution, fulfillment, and independent proof.

## Manual first-sale procedure
1. Verify the transaction directly in the payment provider.
2. Confirm transaction ID, amount NZ$5.00, currency NZD, payer, recipient, and Completed status.
3. Deliver the canonical pack.
4. Record transaction ID, SKU, amount, buyer, delivery timestamp, and proof path.
5. Create resolver_eventregret_proof_<transaction_id>.txt.
6. Do not mark the event VERIFIED by hand. The verification gate owns that state.
