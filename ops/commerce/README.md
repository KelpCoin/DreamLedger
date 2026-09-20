# Commerce Settlement Spine

This directory contains the first live Revenue Atom for DreamLedger.

## Authority model

- Stripe live payment evidence is the settlement authority.
- GitHub Actions is the deterministic reconciliation node.
- The approved-offer catalog is the commercial configuration authority.
- A Checkout Session is recognized only when it is tied to the configured approved Stripe Payment Link, is complete, is paid, is NZD, has the approved amount, and is live mode.
- Reconciliation is idempotent on `STRIPE-CHECKOUT-{checkout_session_id}`.
- No internal field can manufacture verified revenue.

## Current first-sale offer

The settlement meter is currently pointed at the approved DreamLedger Founding Tile:

- SKU: `DL-BILLBOARD-100X100-3000-001`
- Price: NZ$50
- Stripe Payment Link: `https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02`
- Stripe Payment Link ID: `plink_1UAN9zJt4ieIQDFzgHeso6Qo`

The approved offer definition is `BEC-PRIME/catalog/offers/approved.json`.

## GitHub configuration

Create the `settlement-read` environment and add:

- `STRIPE_SECRET_KEY`: live Stripe secret key only.

Set no Stripe credentials in repository files. The workflow fails closed unless `STRIPE_LIVE_ENABLED=true`.

Airtable is optional operational indexing. The settlement meter does not require Airtable to establish whether a Stripe payment occurred.

## Workflow

`.github/workflows/commerce-settlement-sync.yml`

Runs every 10 minutes and manually through GitHub Actions. It:

1. resolves the configured approved live Stripe Payment Link;
2. verifies the live Payment Link identity;
3. reads completed Checkout Sessions;
4. accepts only paid live sessions matching that approved offer's currency and price;
5. emits `proof/commerce/latest-stripe-airtable-reconciliation.json`;
6. hashes the proof and uploads both files as a workflow artifact.

The workflow does not post publicly, send messages, create synthetic revenue, or mark prospects contacted.

## 60-second verification

Open GitHub Actions and run **Commerce Settlement Sync** with `workflow_dispatch`.

Expected pre-sale state:

- `matching_paid_sessions: 0`
- `newly_recognized_events: []`
- `verified_revenue_nzd: 0`

Expected first-sale settlement state:

- one newly recognized `STRIPE-CHECKOUT-cs_...` event
- `verified_revenue_nzd: 50`

A successful workflow run proves the reconciliation path is executable. It does not by itself prove BusinessTruth. Verified commercial truth additionally requires the external customer, fulfillment, delivery evidence, and independent verification chain.
