# BEC-PRIME Intellectual Property Manifest

Status: PUBLIC ARCHITECTURE MANIFEST
Date: 2026-08-12

BEC-PRIME is the sovereign commerce-kernel architecture implemented in this repository. DreamLedger is a public commerce surface built on that kernel.

## Core intellectual property surface

1. Constitution
   - Defines operating rules, trust boundaries, approval boundaries, evidence rules, and silo separation.
   - Located under `BEC-PRIME/CONSTITUTION/`.

2. CUBE compiler
   - Canonical-to-surface transformation layer for offers, products, catalogues, and silo-specific commerce surfaces.
   - The compiler is intended to let one economic kernel produce multiple independent surfaces without merging their state.

3. Multi-LLM refinement
   - Proposer -> Critic -> Monetizer -> Synthesizer refinement loop.
   - LLMs provide probabilistic cognition; deterministic policy and verification remain authoritative.

4. Persistent economic memory
   - Signals, experiments, outcomes, proofs, and decisions become durable machine-readable history.
   - Memory is used to inform later experiments rather than treating every generation as stateless.

5. Browning Gauntlet
   - Adversarial gate for demand, price, margin, fulfilment, evidence, security, policy, duplication, prompt-injection, operational risk, and silo-contamination failure modes.
   - Candidate outcomes are PASS, REWORK/QUARANTINE, or KILL.

6. Commerce Spine
   - Signal -> offer -> exposure -> checkout -> payment -> fulfilment -> evidence.
   - The payment event is the economic truth boundary.

7. Fossil / DreamLedger evidence
   - Durable records of observed economic events.
   - A generated checkout session is not payment proof. A successful payment plus a valid webhook-generated Fossil is payment proof.

8. Silo architecture
   - Independent catalogues and state for Dreamiez, Kelp Atlantis, MTG, and future surfaces.
   - Shared infrastructure is permitted. Unauthorised cross-silo state leakage is not.

## Economic objective

The intended autonomous loop is:

DEMAND -> REFINE -> GAUNTLET -> COMPILE -> DISTRIBUTE -> CHECKOUT -> PAYMENT -> FOSSIL -> MEMORY -> ITERATE

The architecture is designed to reduce human intervention over time. It does not claim that revenue exists merely because code exists.

## Current revenue truth

As of 2026-08-12, the repository records the Commander Deck Diagnostic as the first cash experiment. Revenue remains unproven until a real buyer completes payment and the runtime produces `data/proofs/FIRST_PAYMENT_PROOF.json` from the signed payment webhook.

## Public disclosure boundary

This manifest describes the architecture at a high level. Secrets, payment credentials, private operational data, and internal customer data must never be committed to the public repository.
