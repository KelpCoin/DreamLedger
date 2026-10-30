# CSV Rescue staging repair
Scope: existing PR #890 verifier and export action. No provider writes, deployment, or new payment objects.
Observed defect: a refunded payment fixture returned 200. Changed verifier to bind account, silo/SKU and latest captured charge; reject refunds (including partial), disputes and missing evidence. Each export rechecks entitlement. Repeated verification is read-only; it does not create orders.
40 hermetic checks pass: node scripts/test_data_rescue.cjs. Provider requests, charges and customer sales in those tests: zero. Not an authentic Stripe test-mode journey.
The existing live link plink_1UVoBUEGgEAnUFF9pVYJ5bEw is inactive; existing price price_1UVoAwEGgEAnUFF9QxmwlM3u is NZD 2900, one-time, product prod_VWrmggGG3p4pEk, silo data_tools.
Release HOLD: both available Stripe connections expose only live acct_1SNVPvEGgEAnUFF9. No authenticated test-mode event, persisted order, server-held delivery receipt or external buyer is established. Browser-local processing produces a hash report but cannot revoke already downloaded software/data, and client code is accessible publicly. No claim of durable entitlement protection.
Business fit: repeatable CSV normalization with no AI/provider compute per file. Demand, measured acquisition cost, operating cost and contribution margin UNKNOWN. Seller calculator users may need export cleanup; this is a hypothesis, not measured demand. No paid CTA until delivery gate passes.
Provider references: https://docs.stripe.com/api/charges/object and https://docs.stripe.com/api/payment_intents/retrieve.
