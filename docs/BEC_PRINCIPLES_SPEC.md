# BEC Principles Layer Specification

Version: 1.0.0

## Purpose

The BEC Principles Layer is an implementation-neutral value and optimization contract. It is inherited by governance, truth, validation, observation, compilation, and iterative refinement components.

It answers one question: when several technically valid actions are available, which direction should the system prefer?

## Authority

Human authority is final. Automated components cannot redefine or silently override the principles. Policies may specialize the principles, and cartridges may specialize policies, but neither may weaken universal governance requirements.

## Core economic principles

- Every validated economic event has value, including very small transactions.
- Verified profit is the primary optimization objective unless the human operator explicitly changes it.
- Cash is one economic exhaust, not the complete objective.
- Useful data should feed future decisions and future economic value.
- Economic value, strategic value, and transaction volume are distinct measurements.

## Distribution and monetization

Free white-label entry points are permitted where they increase distribution or adoption. Monetization should exist inside or around resulting silos through transactions, premium capabilities, verification, fulfillment, usage, services, marketplaces, referrals, APIs, or other sustainable value exchanges.

Evergreen digital assets are preferred where they can provide durable value with low marginal delivery cost.

## Reality over architecture

Reality outranks internal consistency. Customer behavior outranks internal belief. Verified economics outrank architectural elegance.

The system must be able to conclude that an attractive internal design is wrong when external evidence says so.

## Truth Oracle

The Truth Oracle exists to reduce self-deception. It must be able to contradict BEC assumptions and reject attractive but unsupported conclusions.

Truth observations should distinguish facts from inferences, preserve provenance, record confidence and freshness, and retain relevant conflicting evidence.

## Sentinels

Sentinels monitor relevant external reality such as markets, competitors, prices, demand, technology, regulation, and sentiment. Real-world changes may trigger re-evaluation of offers, policies, or decisions.

Sentinels may recommend change but cannot rewrite the principles themselves.

## Gauntlet

The Gauntlet is an adversarial evaluation layer. Applicable evaluations may include security, privacy, IP exposure, silo boundaries, pricing, competitors, demand, customer sentiment, human emotion, trends, shadow SKUs, revenue, margin, fulfillment, truth confidence, and operational health.

A blocking Gauntlet failure may stop the affected execution path.

## Governance and emergency control

The system requires both a remote killswitch and a local Windows killswitch. Emergency stopping must fail closed and must not depend on normal agent cooperation.

The human operator remains the final authority.

## Shadow SKUs and lifecycle

A shadow SKU is a cheap economic hypothesis used to test whether a product, service, or silo deserves additional investment.

Assets should move through an evidence-driven lifecycle:

`CREATED -> TESTING -> PROVEN -> SCALING -> DECLINING -> ARCHIVED`

No asset should remain active indefinitely solely because nobody retired it.

## Signal triangulation

Arbitrage and opportunity signals should retain provenance and, where practical, use three stages:

1. Positive signal.
2. Negative or adversarial signal.
3. Final synthesis.

The synthesis becomes an input to decision-making, not a substitute for evidence.

## Elohim optimization

The initial objective is straightforward: maximize verified profit while respecting truth, safety, governance, legality, customer value, and complexity constraints.

Secondary objectives are to reduce human attention, reduce unnecessary complexity, increase reuse, and increase compounding.

Historical outcomes may improve routing, weighting, prioritization, pricing experiments, and resource allocation. The optimization engine cannot redefine constitutional principles.

## Complexity budget

Every new component consumes operational attention. A component should therefore justify itself through measurable value creation, protection, acceleration, or multiplication.

This is the anti-overbuilding guardrail: the system does not climb another technical mountain merely because the climbing equipment already exists.

## Compute

Local compute is preferred when economically and operationally sensible. GPU workloads should have measurable ROI or a clear operational justification. GPU utilization itself is not the objective.

## Silo boundaries

Universal principles apply across silos. Vertical-specific rules belong in policy files rather than in the universal principles layer. This keeps specialized business rules isolated while preserving common governance.

## DreamLedger and evidence

Material economic actions should produce immutable, auditable events. Historical decisions should retain the principles version under which they were made.

The following states must not be collapsed into one claim:

`PROPOSED != EXECUTED != VERIFIED != PAID != PROFITABLE`

Evidence must precede claims.

## Compiler contract

The compiler treats the principles layer as a compile-time constraint. Conflicting configurations must be rejected rather than silently normalized.

The operating rule is:

**Agents propose. Compiler permits. Human can stop.**
