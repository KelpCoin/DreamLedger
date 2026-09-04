# Next sale conversion experiment

Observed live signal: two unpaid checkout sessions reached the NZ$50 Founding Tile payment link. There is no paid event in the observed set.

Objective: move one buyer from checkout intent to completed payment.

Offer: DreamLedger Founding Tile
Price: NZ$50 once
Checkout: https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02

Experiment rule:

1. Keep the existing offer and fulfillment contract unchanged.
2. Create one human-led public conversion surface at a time.
3. Drive qualified traffic to the direct checkout path rather than adding new product complexity.
4. Count only Stripe paid status as a transaction.
5. After payment, let the existing webhook/economic loop create fulfillment and evidence.

Do not infer a purchase from page views, checkout creation, or an open session.
