# 777 Expedition | B2B + A2A Payment Choice | Provider Truth
Date: 2026-11-01 NZDT
Status: PRIVATE DRAFT - SOURCE QUOTES ONLY / DO NOT DEPLOY OR COLLECT MONEY

## Canonical references
- MTG is the master silo/CUBE gold test template, not the only marketplace sector.
- BrownEye Cortex Kingdom owns shared capabilities, including kingdom.auction.v1 (draft DreamLedger PR #913).
- HappyHomarid Patreon + DreamLedger /mtg is the canonical dual-layer creator-membership/public storefront template. Clone its contracts and UX tests only, never members, paid posts, identities, inventory, secrets or brand.
- Reuse the existing 777 task graph, Agent Bridge manifest, marketplace-listing-v1.schema.json and BECK/EMPIRE-SILO-REGISTRY/v1. No second scheduler, payment processor or database.
- Elohim is the sole official Gauntlet scorecard writer. This component does not mint authorization or scorecards.

## Provider source check (live primary pages, 2026-11-01)
- Volley business pricing: https://volley.nz/pricing/ shows NZD 0.35 per business transaction; obtaining merchant onboarding/API approval is unverified for DreamLedger. Not a working payment rail.
- BlinkPay pricing: https://www.blinkpay.co.nz/pricing shows production API Base NZD 99/month plus 0.59% per PayNow transaction, 12-month commitment; Plus NZD 179/month plus 0.49%. GST treatment and exact contractual terms depend on agreement. Its free sandbox is NOT a free production merchant plan.
- Google Kubernetes Engine: https://cloud.google.com/kubernetes-engine/pricing shows cluster management at USD 0.10/hour, with limited monthly credit coverage; compute, storage, egress and other services may cost extra. Kubernetes is an orchestration option, not a free cloud.
- Existing canonical fee doctrine: docs/BECK-EMPIRE-SILO-REGISTRY.json: MTG platform 0%; OTHER 5%. Never silently replace 5% with a proposed 1.5% general marketplace fee or change the permanent MTG override.

## Implemented private component
`webapp/agentic-commerce/marketplace-payment-choice-gate.mjs`:
- Accepts a canonical versioned listing, explicit silo scope, NZD item/quantity/shipping, server-controlled fee policy, human/agent actor, and source-dated processor offers.
- Enforces price parity, payment-currency parity, availability, provider terms provenance, 30-day max quote age, strictly integer minor units and fee-policy invariants.
- Requires mandatory monthly subscription fee and an assumed transaction volume, allocates monthly fees and compares total quoted costs.
- Returns a deterministic SHA256 receipt labelled `QUOTE_ONLY_NOT_PAYABLE`. No payment, no agent mandate, no merchant account, no payout, no purchase/order record, no verified margin.
- Source verification field is a caller assertion, NOT a provider authenticated signing contract. Production callers must validate terms/current accounts independently; tenant identity cannot be client-submitted.
- Agent actions are HELD until exact signed mandate (CUBE ops/mandate_canary.mjs is synthetic-only), revocation, atomic quota and payment permissions are verified.

## Regulatory and commercial HOLD
- Proposal to sell buyer protection/guarantees or hold seller funds is NOT cleared by legal, payments-provider or insurance review. Do not implement claims of escrow, indemnity or statutory exemption from a diagram.
- Bank transfer/P2P reputation-only cannot verify settlement by receiving a buyer screenshot. Use provider/bank-side evidence with consent and fraud controls. Every rail may have different refunds, chargeback and error conditions.
- Published fees are not actual cost of goods, customer acquisition, support, chargebacks, taxes, fraud costs or margin.
- Kelp points are a proposed non-payment loyalty capability, not currency or bank settlement.
- Revenue truth remains NZD 0 verified independent paid-and-fulfilled attributable BECK orders until independently reconciled.

## Acceptance proof and next blocking boundary
`node --test tests/777-marketplace-payment-choice.test.mjs` is the narrow repeatable contract. It must pass on the exact PR HEAD.
The broader `.github/workflows/cube-marketplace-gate.yml` also requires the existing compiler and production contract; their failures remain visible.
Next: independently verify live provider accounts and fees, make one authenticated multi-tenant read-only API using existing 777 listing data, exercise existing Agent Bridge mandate/quota, test two-silo isolation and build a private cloud preview. Only then consider narrowly approved provider onboarding and commerce.
