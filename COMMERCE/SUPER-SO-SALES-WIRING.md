# Super.so Sales Wiring Contract

Status: READY FOR APPROVAL-GATED PUBLICATION

## Canonical architecture

Super.so is presentation only.

DreamLedger is the canonical offer catalogue and evidence boundary.
Stripe is settlement authority.
GitHub Actions is deterministic orchestration and reconciliation.
Airtable is the operational event index.

Flow:

Super.so -> DreamLedger /api/offers -> canonical offer -> Stripe Payment Link -> external payment evidence -> GitHub Actions settlement sync -> Airtable economic event -> DreamLedger proof artifact

## Public catalogue rule

The Super.so front door should show only offers marked `live_payment_link` in `COMMERCE/SALES-CATALOG-2026-08-24.json`.

Offers marked `stripe_product_exists` are internally prepared but must not be represented as publicly activated until their payment link and fulfilment path are verified.

## Button rule

Every buy button must use the canonical Stripe Payment Link from the sales catalogue. Do not reproduce Stripe prices in page code when a canonical payment link exists.

## Product card rule

Each card should expose:

1. Product name.
2. One-sentence outcome.
3. Price and billing cadence.
4. Evidence/fulfilment boundary.
5. Canonical checkout button.

Avoid countdowns, fake scarcity, fake testimonials, unverified revenue claims, or claims that a CI run equals payment.

## Approval gate

The following remain human approval-gated:

- publishing new public offers;
- activating new payment links;
- irreversible production deployment;
- social publication;
- marketplace/payment facilitation;
- claims of verified revenue.

## Hard silos

MTG content remains in the MTG silo.
DreamLedger consumer/commercial offers remain in the DreamLedger silo.
Amplissa/adult material is excluded from this catalogue and from Super.so public commerce pages generated from it.

## Verification

Before public activation:

- verify `/api/offers` contains the intended offer;
- verify the Stripe Payment Link is active and points to the intended product/price;
- verify the success and fulfilment path;
- run the DreamLedger Gauntlet;
- record the resulting proof artifact;
- only then publish.
