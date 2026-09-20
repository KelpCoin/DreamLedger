# First-sale execution checklist — 2026-09-21

**Goal:** One **external** live Stripe payment -> settlement recognized -> fulfilment evidence -> fossil -> verified external revenue > 0.
**Not the goal:** More architecture without a buyer.

## 0. Truth rules

- [ ] Test mode / self-pay / refund loops do not count as verified external revenue.
- [ ] Need: live mode + external customer + paid + attribution + fulfilment evidence + proof artifact.
- [ ] Clicks, checkout starts, workflow runs, tests, and game activity never substitute for payment.
- [ ] Settlement evidence alone does not equal BusinessTruth.

## 1. First-sale inlet

Canonical first-sale offer:

- [ ] Open storefront: https://dreamledger.org/?src=dist
- [ ] Open approved Billboard Payment Link: https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02
- [ ] Confirm live Stripe mode, NZD, NZ$50, and Payment Link ID `plink_1UAN9zJt4ieIQDFzgHeso6Qo`.
- [ ] Confirm fulfillment path: payment -> signed webhook -> finite allocation -> human approval -> publication.
- [ ] Confirm the deliverable and published content policy are available to the buyer.

## 2. Settlement meter

- [ ] GitHub environment `settlement-read` contains `STRIPE_SECRET_KEY`.
- [ ] Run **Commerce Settlement Sync** via `workflow_dispatch`.
- [ ] Pre-sale proof must show `verified_revenue_nzd: 0`.
- [ ] First-sale proof must identify a real live `cs_...` Checkout Session for the approved NZ$50 offer.

## 3. Authorized demand pulse

Use the existing distribution starter pack.

- [ ] Use an approved owned channel or other explicitly authorized channel.
- [ ] Expose the canonical offer once.
- [ ] Do not mass-spam cold communities.
- [ ] Do not claim scarcity, traffic, sales, or buyer activity that cannot be evidenced.
- [ ] Human performs any external send that requires judgment or new-channel authorization.

## 4. When a stranger pays

- [ ] Stripe reports a live paid Checkout Session.
- [ ] Settlement sync recognizes the session.
- [ ] Confirm the buyer is external and not a test/self-payment.
- [ ] Fulfill within the promised scope.
- [ ] Store delivery evidence.
- [ ] Independently verify the placement/publication.
- [ ] Seal the fossil.
- [ ] Only then update verified external revenue / BusinessTruth.

## 5. Stop conditions

- Stop inventing new SKUs before the first validated sale.
- Stop treating workflow-green as revenue.
- Stop treating payment alone as completed commerce.
- Stop architectural expansion unless a demonstrated economic bottleneck requires it.

## Success

**One real stranger -> one real payment -> one real fulfillment -> one independently verified fossil.**
