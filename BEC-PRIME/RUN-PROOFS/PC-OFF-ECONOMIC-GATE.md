# PC-OFF ECONOMIC GATE

Purpose: keep BEC-PRIME execution on GitHub-hosted infrastructure wherever possible.

Canonical approved offer:

- offer_id: OFFER-BEC-PRIME-ARCHITECTURE-AUDIT
- price: 49
- currency: NZD
- checkout_route: /api/offer-checkout/create

Economic state machine:

APPROVED -> CHECKOUT_CREATED -> PAYMENT_VERIFIED -> FULFILLMENT_RECORDED -> FOSSIL_CREATED

Rules:

1. A GitHub commit is not revenue.
2. A checkout URL is not revenue.
3. Only verified Stripe payment evidence may create PAYMENT_VERIFIED.
4. Fulfillment evidence must exist before FOSSIL_CREATED.
5. No workflow may fabricate payment, revenue, customer, or bank settlement.
6. Public posting remains approval-gated.
7. Private IP remains excluded from public artifacts.
8. MTG and adult silos remain isolated.

Operator target:

Run the existing first-sale gate from GitHub-hosted infrastructure, capture the result as an artifact, and stop at the first genuine external dependency instead of inventing success.
