# TRADE ME GAP ATOMIZATION V1 - 2026-09-29

## Purpose

Measure the real infrastructure disparity between DreamLedger and an established New Zealand marketplace without pretending the gap can be closed by copying the incumbent.

Trade Me is the benchmark for marketplace maturity, not a dependency.

## Atomized disparity

| Capability | Established marketplace state | DreamLedger state | Gap | Bridge |
|---|---|---|---|---|
| Buyer liquidity | Large established audience and repeat traffic | No verified marketplace liquidity | CRITICAL | Free utility acquisition + first-category liquidity tests |
| Seller liquidity | Large inventory base | Very small/none verified | CRITICAL | Free seller tools + listing import/preparation |
| Search/discovery | Mature marketplace search/ranking | Basic public surfaces | CRITICAL | PostgreSQL search first; OpenSearch only when measured scale requires it |
| Identity | Mature account system and account history | Supabase Auth available; marketplace identity model incomplete | HIGH | Identity continuity + verification state + privacy boundaries |
| Reputation | Long-running feedback history | No marketplace reputation history | CRITICAL | Verified transaction reputation, not self-reported ratings |
| Listing system | Mature listing/auction/Buy Now flows | Partial catalog/offer infrastructure | CRITICAL | Build minimum listing lifecycle first |
| Buyer checkout | Integrated | Stripe infrastructure exists, marketplace checkout not proven | CRITICAL | Payment state machine + external settlement proof |
| Seller payouts | Established | Not yet marketplace-grade | CRITICAL | Stripe Connect evaluation, then live transaction test |
| Buyer protection | Ping/Afterpay Buyer Protection up to NZ$5,000 for eligible transactions | None equivalent | CRITICAL | Start with explicit evidence/dispute process; only later consider financial protection |
| Disputes | Dedicated policy/process and support surface | Not established | CRITICAL | Dispute state machine + evidence requirements + human adjudication |
| Trust & Safety | Dedicated team, policies, scam response, listing rules | Truth/evidence substrate but no marketplace operations team | CRITICAL | Automated prechecks + evidence collection + human escalation |
| Fraud controls | Established payment controls, scam detection and account controls | Partial technical controls | HIGH | Risk signals, velocity controls, transaction anomaly detection |
| Product safety | Rules, prohibited/restricted items, regulatory guidance | Not marketplace-operationalized | HIGH | Category policy registry + listing gate |
| IP/counterfeit controls | Rights-holder program and takedown process | None | HIGH | Provenance/IP claim workflow; do not claim equivalence |
| Shipping | Book a Courier with Aramex/NZ Post integrations | No equivalent | HIGH | Start with shipping estimator/label handoff, integrate only after demand |
| Notifications | Mature transactional communications | Partial infrastructure | MEDIUM | Event-driven notification service |
| Customer support | Established support operation | Human capacity is tiny | CRITICAL | Self-service evidence/dispute workflow + narrow escalation |
| Legal/compliance | Mature terms, policies, moderation, NZ marketplace experience | Early-stage | CRITICAL | Policy registry + review gates + category restrictions |
| Reliability | Production systems at national scale | Small production footprint | HIGH | Observability, durable jobs, retries, failure recovery |
| Data history | Years of transactions and reputation signals | No marketplace history | CRITICAL | Verified transaction event ledger |
| Network effects | Strong | None | CRITICAL | Start with one narrow category and one acquisition wedge |
| Seller economics | Mature pricing/fee structure | No validated marketplace unit economics | CRITICAL | Measure transaction margin before adding fees |
| Buyer confidence | Institutional brand recognition | Unproven | CRITICAL | Evidence-rich listings + transparent dispute rules + verified outcomes |
| Agentic commerce | Existing marketplace APIs are constrained for casual Marketplace transactions | Architecture can be designed agent-first | FUTURE ADVANTAGE | Build machine-readable evidence, offers and transaction states without relying on speculative demand |

## What NOT to build first

Do not attempt to reproduce:
- national-scale marketplace liquidity
- a full auction engine
- every product category
- a courier fleet
- a 24/7 support operation
- a full fraud department
- a giant recommendation model
- a custom vector database
- a new payment processor
- every agentic-commerce protocol

These are scale consequences, not first-order prerequisites.

## The minimum credible marketplace

DreamLedger needs only this first:

1. Account
2. Seller identity continuity
3. Listing
4. Item evidence
5. Buyer discovery
6. Offer/Buy Now
7. Payment
8. Seller fulfillment
9. Delivery evidence
10. Buyer confirmation
11. Dispute path
12. Verified transaction record
13. Reputation event

That is the first complete economic loop.

## Open-source bridge strategy

Use existing infrastructure instead of recreating commodity systems.

### Data/auth/storage/realtime

Keep Supabase as the economic system of record. It already provides Postgres, Auth, Storage, Realtime, Edge Functions and vector/embedding tooling.

Official project:
https://github.com/supabase/supabase

### Commerce primitives

Evaluate Medusa before writing a custom commerce core. Its open-source core provides commerce modules and explicitly supports marketplace use cases.

Official project:
https://github.com/medusajs/medusa

Alternative: Saleor for a GraphQL-native composable commerce core.

Official project:
https://github.com/saleor/saleor

Do not install either merely because they exist. First compare their data model with the existing DreamLedger transaction/evidence model.

### Marketplace scaffolding

Mercur is an open-source multi-vendor marketplace built on Medusa, with vendor, admin and storefront components.

Repository:
https://github.com/strata-lab/marketplace

Treat it as scaffolding to mine for patterns, not as an automatic dependency.

### Search

Use Postgres search first. If measured catalogue/query scale requires a dedicated engine, OpenSearch is an Apache-2.0 open-source search engine with mature distributed search capabilities.

Official project:
https://github.com/opensearch-project/OpenSearch

Do not introduce a second search database before query volume proves it necessary.

### Marketplace payments

Use Stripe's marketplace primitives rather than inventing money movement. Stripe Connect is designed for platform/marketplace payments and seller onboarding.

Reference implementation:
https://github.com/auchenberg-stripe/stripe-sample-connect-global-marketplace

This is implementation reference only. Live money movement remains a human-authorized gate.

## Existing DreamLedger assets that already reduce the gap

DreamLedger already has:
- Supabase/Postgres
- Auth/Storage/Edge Function substrate
- Stripe
- evidence/proof concepts
- economic state machine
- dispatch semantics
- fulfillment contracts
- mass opportunity admission
- Dapr orchestration preparation
- market readiness sentinel
- public free utility wedge
- existing catalogue/offer surfaces

Therefore the missing problem is not "build a marketplace from zero."

It is:

TURN THESE PRIMITIVES INTO ONE CLOSED MARKETPLACE TRANSACTION LOOP.

## Build order

### Phase 1: acquisition

Free cost-of-living utility -> item/value discovery -> listing preparation.

### Phase 2: inventory

Seller account -> listing -> evidence -> searchable inventory.

### Phase 3: transaction

Buyer -> offer/Buy Now -> payment -> transaction record.

### Phase 4: fulfillment

Seller dispatch -> delivery evidence -> buyer confirmation.

### Phase 5: trust

Dispute -> evidence -> decision -> resolution -> reputation.

### Phase 6: liquidity

One category -> repeated sellers -> repeated buyers -> repeat transactions.

### Phase 7: platform expansion

Additional categories, shipping integrations, professional sellers, richer search.

### Phase 8: agentic commerce

Machine-readable listings, offers, authorization, evidence, settlement and verification APIs.

## Scale targets

Do not use Trade Me's scale as an immediate engineering target.

Use a staircase:

1 verified transaction
10 transactions
100 transactions
1,000 transactions
10,000 transactions

At each step measure:
- buyer acquisition cost
- seller acquisition cost
- listing-to-sale conversion
- time-to-sale
- average transaction value
- payment cost
- fulfillment cost
- dispute rate
- fraud loss
- support minutes per transaction
- gross margin
- repeat purchase rate
- repeat seller rate

Only then choose infrastructure upgrades.

## Strategic moat

The moat should not be "we have listings."

It should become:

FREE UTILITY
-> DISCOVERY
-> EVIDENCE-RICH LISTING
-> TRUSTED IDENTITY
-> SAFE PAYMENT
-> VERIFIED FULFILLMENT
-> DISPUTE RESOLUTION
-> REPUTATION
-> REPEAT TRADE
-> MACHINE-READABLE TRANSACTION
-> AGENTIC COMMERCE

The first nine stages are useful now.

The last stage becomes increasingly valuable as agentic commerce matures.

## Truth boundary

Current verified DreamLedger marketplace revenue remains NZ$0.00.

No liquidity, protection, transaction volume, reputation or support capability should be claimed until externally demonstrated.

## Immediate engineering priority

The next highest-value build is not a clone of Trade Me.

It is the smallest complete DreamLedger marketplace transaction loop, attached to the free cost-of-living acquisition wedge, with every transition producing evidence.

Everything else should queue behind that.
