# DreamLedger Production Deployment Repair

## Objective

Make the canonical BEC-PRIME commerce surface reach dreamledger.org and verify the deployed commit before treating the release as live.

## Required production truth

- Source of truth: main branch.
- Deployment target: Render service dreamledger-bec-prime.
- Public domain: https://dreamledger.org
- Revenue truth: only Stripe-confirmed external payments count.
- No self-purchases.

## Release sequence

1. Confirm the latest main commit contains the canonical commerce catalog.
2. Confirm the Render service is connected to the main branch.
3. Set Render auto-deploy to On Commit if automatic deployment is desired.
4. Deploy the latest main commit through Render API or Dashboard.
5. Wait for deployment status `live`.
6. Verify `/healthz` returns HTTP 200.
7. Verify `/version` identifies the deployed commit.
8. Verify the homepage contains the canonical commerce surface.
9. Verify the canonical Stripe checkout URLs are reachable.
10. Record a proof artifact containing timestamp, commit, deploy status, endpoint status, and checkout reachability.

## Important guardrail

Do not use GitHub Actions status alone as evidence that Render is live. Do not call a Payment Link revenue. A checkout URL is only a sales surface. Revenue requires an independently verified external Stripe payment.

## Economic gate

After production verification, the next operation is distribution to legitimate prospective buyers. The objective is Buyer #1, not additional architecture.
