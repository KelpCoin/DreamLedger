# CUBE B2B Marketplace v1

The marketplace is a cross-silo discovery and procurement layer. It does not replace source-silo catalogs.

Live source silos:

- MTG
- DreamMeez
- Media & Music
- Digital Products
- NZ Secondhand

Source-silo products retain their SKU, seller, inventory, condition/license metadata, fulfillment contract and evidence chain.

Marketplace operations:

1. Seller onboarding and approval.
2. Listing publication.
3. Buyer discovery.
4. Order creation.
5. Payment state.
6. Fulfillment state.
7. Platform fee accounting.
8. Seller payout state.
9. Dispute/evidence state.

The current implementation uses a single operator seller for real catalog inventory. External seller payout activation is intentionally separate and should use Stripe Connect rather than passing seller funds through an operator account. Stripe's May 2026 marketplace guidance identifies seller onboarding/KYC, routing, refunds and payouts as distinct marketplace payment concerns. Research also consistently recommends a clean monolith with explicit module boundaries before service decomposition.
