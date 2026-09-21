# Commerce Settlement Spine

This directory contains the first live Revenue Atom for DreamLedger.

## Authority model

- Stripe live payment evidence is the settlement authority.
- GitHub Actions is the deterministic reconciliation node.
- The approved-offer catalog is the commercial configuration authority.
- A Checkout Session is recognized only when it is tied to a configured approved Stripe Payment Link, is complete, is paid, is NZD, has the approved amount, and is live mode.
- Reconciliation is idempotent on `STRIPE-CHECKOUT-{checkout_session_id}`.
- No internal field can manufacture verified revenue.

## Approved settlement offers (explicit)

Both of the following are approved in `BEC-PRIME/catalog/offers/approved.json` and are eligible for settlement recognition when the workflow is configured against their Payment Link.

### Primary (current workflow target) — Founding Tile NZ$50

- SKU: `DL-BILLBOARD-100X100-3000-001`
- Offer ID: `OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001`
- Price: NZ$50
- Currency: NZD
- Stripe Payment Link (approved catalog): `https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02`
- Stripe Payment Link ID: `plink_1UAN9zJt4ieIQDFzgHeso6Qo`
- Status: primary first-sale settlement target

### Secondary (also approved) — Commander Diagnostic NZ$29

- SKU: `CMD-DIAG-29`
- Offer ID: `OFFER-CMD-DIAG-29-NZD`
- Price: NZ$29
- Currency: NZD
- Stripe Payment Link (approved catalog): `https://buy.stripe.com/8x28wQ0cwbn48CA3mM9oc00`
- Stripe Payment Link ID: `plink_1UAJyVJt4ieIQDFzj4kA5B7x`
- Status: secondary offer; retained and settlement-eligible

**Note on live distribution links:** Public storefront and distribution-pack links may differ from the catalog entries above. The settlement meter only accepts the Payment Link that is both (a) present in the approved catalog and (b) configured into the workflow environment / `STRIPE_PAYMENT_LINK_URL`. Do not treat a different public link as settled until the catalog + workflow configuration are aligned to it.

The approved offer definition remains `BEC-PRIME/catalog/offers/approved.json`.

## GitHub configuration

Create the `settlement-read` environment and add:

- `STRIPE_SECRET_KEY`: live Stripe secret key only.

Set no Stripe credentials in repository files. The workflow fails closed unless `STRIPE_LIVE_ENABLED=true`.

Airtable is optional operational indexing. The settlement meter does not require Airtable to establish whether a Stripe payment occurred.

## Workflow

`.github/workflows/commerce-settlement-sync.yml`

Runs every 10 minutes and manually through GitHub Actions. It:

1. resolves the configured approved live Stripe Payment Link (currently the NZ$50 Founding Tile);
2. verifies the live Payment Link identity against the approved catalog;
3. reads completed Checkout Sessions;
4. accepts only paid live sessions matching that approved offer's currency and price;
5. emits `proof/commerce/latest-stripe-airtable-reconciliation.json`;
6. hashes the proof and uploads both files as a workflow artifact.

To accept the NZ$29 diagnostic instead (or in a second parallel job), set `STRIPE_PAYMENT_LINK_URL` to the diagnostic Payment Link from the approved catalog and re-run. Do not invent a second revenue path without catalog alignment.

The workflow does not post publicly, send messages, create synthetic revenue, or mark prospects contacted.

## 60-second verification

Open GitHub Actions and run **Commerce Settlement Sync** with `workflow_dispatch`.

Expected pre-sale state:

- `matching_paid_sessions: 0`
- `newly_recognized_events: []`
- `verified_revenue_nzd: 0`

Expected first-sale settlement state (tile):

- one newly recognized `STRIPE-CHECKOUT-cs_...` event
- `verified_revenue_nzd: 50`

Expected first-sale settlement state (diagnostic, if configured):

- one newly recognized `STRIPE-CHECKOUT-cs_...` event
- `verified_revenue_nzd: 29`

A successful workflow run proves the reconciliation path is executable. It does not by itself prove BusinessTruth. Verified commercial truth additionally requires the external customer, fulfillment, delivery evidence, and independent verification chain.

## Honest meter (2026-09-21)

Verified external revenue remains **NZ$0** until a real external live paid Checkout Session is recognized, fulfilled, and fossilized. Game / Shallows activity does not count as business revenue.
