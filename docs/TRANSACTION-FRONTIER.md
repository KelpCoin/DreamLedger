# Transaction Frontier v1

Date: 2026-09-29

## Purpose

This document converts the 500-pain corpus and 300-primitive factory into an intentionally small economic frontier.

The frontier is not a product backlog. It is a controlled hunting surface for finding the first independently evidenced transaction.

## Economic truth

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

These values remain unchanged until the existing economic truth boundary is crossed.

## Four transaction families

| Family | Reusable operation | Candidate product | Primary proof boundary |
|---|---|---|---|
| Money reconciliation | reconciliation + anomaly detection + evidence | reconciliation run / exception recovery | payment/ledger source + exception evidence |
| Quote/procurement intelligence | quote normalization + comparison + scope-gap detection | quote comparison | source quotes + comparison output |
| Supplier/party verification | entity resolution + credential verification + monitoring | supplier verification | authoritative registry/credential source |
| Contract/obligation intelligence | requirement extraction + completeness + next action | obligation extraction/tracking | authoritative contract/version |

## First transaction candidate

QUOTE NORMALIZATION is the current first transaction candidate because it can be delivered as a discrete digital artifact without requiring a marketplace to exist first.

The candidate is not approved as a revenue-producing product merely because the market exists.

Required proof sequence:

1. Identify one real buyer.
2. Obtain one real quote set from that buyer.
3. Confirm the buyer's requested outcome and authorization to process the material.
4. Produce one comparison artifact.
5. Deliver it through the agreed legitimate surface.
6. If paid, observe settled external payment with attribution.
7. Fulfil the promised comparison.
8. Preserve independent evidence of delivery and outcome.
9. Only then classify the transaction as an economic outcome.

## Candidate primitive composition

TP-Q01 INPUT: PDF/email/spreadsheet supplier quotes.

TP-Q02 EXTRACTION: extract supplier, line item, quantity, unit, price, tax, freight, lead time, warranty, exclusions and assumptions.

TP-Q03 NORMALIZATION: map heterogeneous quote fields into a common comparison schema.

TP-Q04 COMPARISON: calculate like-for-like totals and identify materially different terms.

TP-Q05 EXCEPTION DETECTION: identify missing scope, inconsistent units, exclusions, unclear assumptions and non-comparable terms.

TP-Q06 DECISION PACKET: produce an auditable comparison with source references and unresolved exceptions.

These are a transaction slice, not six new economic systems. Existing extraction, normalization, evidence, payment and Truth Oracle infrastructure must be reused.

## Buyer gate

A candidate quote buyer is not considered real merely because:
- a market exists;
- a competitor exists;
- a public listing exists;
- a pricing page exists;
- an internal agent identifies a plausible buyer;
- a generated lead exists.

REAL_BUYER requires an identifiable external counterparty demonstrating actual demand for the specific deliverable.

## Product gate

The product is buyer-facing.

Example:

"Compare this supplier quote set and return an evidence-backed like-for-like decision packet."

The primitive remains internal reusable machinery.

## Fulfillment acceptance

The product must pass the canonical forensic fulfillment contract:

G1 Observed Opportunity
G2 Real Demand
G3 Required Capability
G4 Required Data
G5 Legitimate Access
G6 Representation / Authority
G7 Executable Workflow
G8 Validation
G9 Delivery Surface
G10 External Action

Failure at any required gate prevents classification as fully fulfillable.

## Distribution rule

Do not build marketplace liquidity before the first transaction.

The initial distribution path may be:
- direct buyer contact;
- an existing procurement community;
- an existing marketplace/job board where permitted;
- an authorized partner;
- an existing DreamLedger distribution surface.

Every external submission remains subject to authorization and platform rules.

## Primitive transfer test

After one fulfilled transaction, apply the same operation to a second domain.

Transfer is successful only if the same core operation survives with bounded adapter changes.

Record:
- shared input concepts;
- shared normalization schema;
- domain-specific adapter fields;
- exceptions unique to the domain;
- human minutes;
- external evidence requirements;
- payment/fulfilment differences.

A primitive that requires a separate bespoke implementation for every domain has failed the reusability test.

## Frontier promotion

CANDIDATE
-> BUYER_OBSERVED
-> DEMAND_CONFIRMED
-> AUTHORIZED
-> FULFILLABLE
-> PRODUCT_READY
-> TRANSACTION_ATTEMPTED
-> PAYMENT_OBSERVED
-> FULFILLED
-> VERIFIED
-> TRANSFER_TEST
-> REUSABLE_PRIMITIVE

No state may be skipped.

## Swarm/CUBE operating contract

CUBE owns the canonical state and economic truth boundary.

Swarm workers may:
- discover demand;
- qualify candidates;
- prepare artifacts;
- test primitive transfer;
- detect blockers;
- prepare human gates;
- verify external evidence.

Swarm workers may not:
- manufacture buyers;
- self-purchase;
- convert internal actions into revenue;
- bypass authorization;
- mark fulfilment from preparation alone;
- create verified outcomes without independent evidence.

Gauntlet challenges the proposed transaction before external commitment.

Elohim proposes the next safe economic action.

Truth Oracle verifies the external evidence boundary.

The system stops only when:
- a legitimate human gate is required;
- an external event is awaited;
- fulfilment is actively underway;
- or a verified economic outcome has been recorded.

## First-dollar operating objective

When the system is active and no legitimate external event is being awaited, the preferred work is:

REAL DEMAND -> REAL BUYER -> EXACT DELIVERABLE -> AUTHORIZATION -> FULFILMENT -> PAYMENT -> EVIDENCE

not additional architecture.

## Current classification

QUOTE NORMALIZATION: CANDIDATE

MONEY RECONCILIATION: CANDIDATE

SUPPLIER VERIFICATION: CANDIDATE

CONTRACT/OBLIGATION INTELLIGENCE: CANDIDATE

None is yet verified revenue.
