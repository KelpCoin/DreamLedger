# Kiwi Trust Marketplace Wedge V1

## Strategic position

DreamLedger should not try to recreate Trade Me's entire marketplace before it has liquidity.

The first objective is to own a narrow loop:

FREE COST-OF-LIVING UTILITY -> HOUSEHOLD ITEM -> VALUE ESTIMATE -> LISTING PREPARATION -> TRUST RECORD -> BUYER -> SETTLEMENT -> AFTERCARE -> REPUTATION

The free utility is the acquisition wedge. The transaction layer is the monetization layer. The trust record is the moat.

## Why this is different from a generic marketplace

Trade Me's current Marketplace changes show the incumbent is actively improving transaction safety: casual sellers no longer pay the former 7.9% success fee, Ping is the primary payment method, bank transfer has been removed, and Buyer Protection for eligible Ping/Afterpay purchases is up to NZ$5,000.

DreamLedger should therefore not compete on "we also have listings."

It should compete on inspectable transaction history and seller/buyer evidence, while initially concentrating on categories where the user can benefit from structured verification.

## Free acquisition wedge

Public route: /free

The first wedge is a free household money tool. It should answer:

- What could I save?
- What could I recover by selling?
- What would I actually keep after fees and shipping?
- Is this item worth listing?

The current free route points to the existing NZ seller profit calculator and marketplace surface. It makes no claim that DreamLedger currently provides Trade Me-equivalent protection.

## Trust primitives to build in order

1. Identity continuity
A transaction should bind the platform account, listing, payment event and fulfillment record without exposing unnecessary personal information.

2. Item evidence
Allow structured condition statements, photos or documents, provenance notes, serial/model data where appropriate, and timestamps.

3. Transaction evidence
Keep payment, shipment, delivery and dispute events distinct. Never infer payment from a listing or checkout.

4. Dispute/aftercare record
Define exactly what is covered, what evidence is required, the response window, and who makes the decision.

5. Reputation
Reputation should be derived from verified transaction events, not self-reported claims.

6. Evidence-backed listings
Let buyers inspect what is known, what is claimed by the seller, and what has been independently verified.

## Economic model

The initial platform should avoid charging for the free utility.

Potential later revenue surfaces, subject to real demand:
- transaction fee
- optional seller tools
- verification services
- promoted discovery
- fulfillment/shipping margin
- business seller services
- agentic transaction services

Do not implement all of these now.

First prove that the free utility causes people to bring an item to the platform and that at least one transaction can be completed with an independent buyer.

## Liquidity rule

Do not open dozens of categories simultaneously.

A category earns expansion only after:
- listings are arriving without paid acquisition,
- buyers can find relevant inventory,
- at least one real transaction closes,
- the transaction evidence chain closes,
- dispute/aftercare behaviour is observable,
- unit economics are measured.

## Incumbent gap analysis

Trade Me currently provides significant transaction infrastructure, including Ping and Buyer Protection. DreamLedger therefore should not claim institutional-grade protection before it actually has equivalent mechanisms.

The strategic gap to close is not "more listings."

It is:

FREE UTILITY -> TRUSTED IDENTITY -> EVIDENCE-RICH LISTING -> SAFE TRANSACTION -> VERIFIED AFTERCARE -> REPUTATION

That sequence can become the substrate for future agentic commerce because the same transaction evidence can later be consumed by software agents.

## Privacy / idea protection

Public product copy should reveal the consumer benefit, not proprietary scoring formulas, market timing thresholds, source weighting, anti-fraud heuristics, or internal selection logic.

Those remain private.

Public:
- what the tool does,
- what the user receives,
- what protections actually exist.

Private:
- scoring,
- routing,
- market-readiness thresholds,
- fraud heuristics,
- source independence methods,
- future agentic settlement strategy.

## Current non-claims

DreamLedger does not currently have Trade Me-scale liquidity.
DreamLedger does not currently have Trade Me-equivalent Buyer Protection.
DreamLedger does not currently have a verified external marketplace transaction through this wedge.
The free route is an acquisition surface, not evidence of traction.

## Immediate next economic test

Drive the free route toward one measurable behaviour:

VISITOR -> FREE TOOL -> ITEM IDENTIFIED -> LISTING PREPARED -> LISTING PUBLISHED -> BUYER -> SETTLED PAYMENT -> FULFILLMENT -> VERIFIED TRANSACTION.

The next engineering work should reduce friction between those states, not expand the architecture sideways.
