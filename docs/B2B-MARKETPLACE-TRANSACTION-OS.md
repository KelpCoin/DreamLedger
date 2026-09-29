# B2B Marketplace Transaction OS v1

Date: 2026-09-29
Status: BUILD FRONTIER

## Objective

Build a full-B2B competitor to a general marketplace by owning the transaction layer rather than copying a consumer listing surface.

The shared object is a transaction:

REQUIREMENT -> DISCOVERY -> RFQ -> OFFER -> TRUST -> AGREEMENT -> PAYMENT -> FULFILMENT -> DELIVERY -> ACCEPTANCE -> RECONCILIATION -> DISPUTE -> REPEAT

## What is reusable

The marketplace uses one domain-blind transaction kernel with adapters for goods, services, surplus assets, procurement and digital work.

Core objects:
- buyer requirement
- listing / capability
- RFQ
- supplier response
- normalized offer
- counterparty evidence
- agreement
- payment reference
- delivery record
- acceptance record
- reconciliation
- dispute
- evidence packet
- transaction passport

## Universal problem strategy

The existing 400-pain corpus is research input. It must not become 400 checkout pages.

Pains cluster into reusable transaction primitives:
- discover / match
- identity / verify
- ingest / extract
- normalize / compare
- RFQ / offer
- negotiate / agree
- payment / reconcile
- deliver / accept
- dispute / evidence
- renew / reorder

A new silo is justified only when the buyer, transaction, fulfilment contract and public value proposition are distinct.

## Product ladder

### Layer 1: Marketplace
Searchable listings, structured requirements, RFQs and offers.

### Layer 2: Trust
Business identity, credentials, transaction history and evidence.

### Layer 3: Procurement
Quote normalization, scope-gap detection, landed-cost comparison and approval.

### Layer 4: Settlement
Payment references, fees, refunds, credits, invoice and payout reconciliation.

### Layer 5: Fulfilment
Delivery state, acceptance, evidence and exception handling.

### Layer 6: Repeat commerce
Saved requirements, supplier memory, recurring orders, reorder triggers and negotiated terms.

## Current live wedge

QUOTE-COMPARE-49 is the first public transaction-service wedge because it is already attached to a real payment boundary and an automated intake/fulfilment path.

Other toll booths remain hypotheses until their fulfilment contracts are implemented and tested.

## Silo readiness contract

CANDIDATE -> PREPARED -> GATED -> READY -> LIVE -> TRANSACTING -> VERIFIED

READY requires:
1. public URL
2. exact offer
3. price/currency
4. input contract
5. fulfilment contract
6. delivery mechanism
7. payment boundary where advertised
8. evidence boundary
9. health check
10. CI/CD verification

LIVE means the surface is externally reachable and its advertised path is operational. It does not mean revenue.

VERIFIED requires independent buyer, settled payment, fulfilled output and independent evidence.

## Swarm / Cube

CUBE owns canonical state and economic truth.

Swarm:
- discovers demand
- maps problems to primitives
- prepares listings/RFQs
- tests adapters
- monitors transactions
- verifies evidence
- proposes the next safe action

Gauntlet:
- challenges authority, scope, evidence, fraud and execution assumptions.

Elohim:
- chooses the next safe economic action from observed state.

Truth Oracle:
- decides whether external evidence crosses the verification boundary.

The system must never manufacture demand, self-purchase, or convert internal activity into revenue.

## Sandbox rule

New marketplace tooling is sandboxed from economic truth until it has:
- deterministic inputs
- deterministic state transitions
- idempotency
- failure/retry behavior
- evidence outputs
- no revenue-write capability

MTG may be used as a high-density transaction sandbox, but MTG activity cannot certify B2B economic outcomes.

## Economic truth

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0
