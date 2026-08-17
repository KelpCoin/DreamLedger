# Commerce Settlement Spine

This directory contains the first live Revenue Atom for DreamLedger.

## Authority model

- Stripe live payment evidence is the settlement authority.
- Airtable `Economic Events` is the operational economic index.
- Airtable `Offers` holds the commercial offer and canonical payment doorway.
- GitHub Actions is the deterministic reconciliation/orchestration node.
- A Checkout Session is recognized only when it is tied to the configured Stripe Payment Link, is complete, is paid, is NZD, and totals NZ$29.
- Reconciliation is idempotent on `STRIPE-CHECKOUT-{checkout_session_id}`.
- No Airtable field can manufacture verified revenue.

## GitHub configuration

Create the `settlement-read` environment. Add these environment secrets:

- `STRIPE_SECRET_KEY`: live Stripe secret key only.
- `STRIPE_PAYMENT_LINK_URL`: `https://buy.stripe.com/28EcN54zraG13M3g3idwc1t`
- `AIRTABLE_TOKEN`: Airtable personal access token with access to the BEC PRIME Economic Evidence base and the records needed by the workflow.

Add environment variable:

- `STRIPE_LIVE_ENABLED=true`

Do not place credentials in the repository. GitHub recommends secrets for sensitive values and least-privilege credentials. Environment secrets can also be protected by deployment approval rules. See the official GitHub Actions secrets and environments documentation.

## Workflow

`.github/workflows/commerce-settlement-sync.yml`

Runs every 10 minutes and manually through GitHub Actions. It:

1. resolves the configured live Stripe Payment Link;
2. reads completed Checkout Sessions;
3. accepts only paid NZ$29 sessions for that exact link;
4. writes a verified `PAYMENT` event to Airtable `Economic Events` if it has not already been recorded;
5. changes `OFFER-CMD-DIAG-29-NZD` to `VALIDATED` after the first verified payment;
6. emits `proof/commerce/latest-stripe-airtable-reconciliation.json`;
7. uploads the proof as a GitHub Actions artifact.

The workflow does not post publicly, send messages, create synthetic revenue, or mark prospects contacted.

## 60-second verification

Open GitHub Actions and run `Commerce Settlement Sync` with `workflow_dispatch`.

Then inspect the workflow artifact named `commerce-settlement-proof-{run_id}`.

Expected pre-sale state:

- `matching_paid_sessions`: 0
- `newly_recognized_events`: []
- `verified_revenue_nzd`: 0

Expected first-sale state:

- one newly recognized `STRIPE-CHECKOUT-cs_...` event
- `verified_revenue_nzd`: 29
- Airtable `Economic Events.Verified`: true
- Airtable `Offers.Status`: VALIDATED

A successful workflow run proves the reconciliation path is executable. It does not prove revenue unless Stripe reports a real paid live Checkout Session.
