# B2B Marketplace Contract

Status: PRIMARY COMMERCIAL SURFACE
PC requirement: NONE

## Economic loop

SELLER -> LISTING -> DISCOVERY -> BUYER INTENT -> CHECKOUT -> PAYMENT VERIFIED -> FULFILLMENT -> LEDGER PROOF

A listing is not a sale. A checkout is not a payment. A payment is not fulfillment. Only verified payment plus fulfillment creates a commercial fossil.

## Product boundary

The marketplace is the primary B2B commerce surface. Audit products are not the default commercial strategy.

The marketplace must support:

- seller onboarding
- buyer discovery
- canonical SKU/listing identity
- price and currency
- inventory or capacity
- checkout
- payment verification
- fulfillment state
- seller/buyer evidence
- ledger events
- dispute-safe state transitions

## Approval boundary

No public listing, external message, or transaction is generated automatically without the existing approval controls. Internal generation and testing may run autonomously on GitHub-hosted infrastructure.

## Silo boundary

MTG inventory remains isolated from unrelated B2B inventory. Adult/Amplissa surfaces remain isolated from MTG and marketplace data. Cross-silo asset reuse is allowed only where an explicit canonical asset contract permits it.

## PC-off operation

The marketplace compiler, validation, catalog generation, Gauntlet, health checks, and proof generation should run on GitHub-hosted runners or deployed cloud services. A local Windows machine must not be a required runtime dependency.

## Immediate gate

The next implementation gate is a real marketplace transaction path using a non-sensitive B2B listing:

1. canonical listing exists
2. listing is approved
3. buyer-facing surface renders it
4. checkout endpoint resolves it
5. payment webhook verifies settlement
6. fulfillment is recorded
7. proof artifact is written

Do not count generated listings, test orders, checkout sessions, or GitHub commits as revenue.
