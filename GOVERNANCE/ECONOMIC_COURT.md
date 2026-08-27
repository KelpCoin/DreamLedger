# Economic Court

## Purpose

The Economic Court is the persistent evidence layer for commercial decisions.

ChatGPT is an operator. It is not the source of truth.

## Authority order

1. Stripe: payment truth.
2. Supabase: live allocation and operational state.
3. GitHub: historical record, governance, proofs, and reproducible checks.
4. Local BrownEye Cortex: computation, analysis, proposals, and mirrored evidence.
5. Notion/Airtable: human-readable cockpit only.

## Truth classes

FACT = externally observable event.

INFERENCE = machine-generated interpretation of facts.

DECISION = governance action based on facts and explicitly recorded inference.

A decision must never be presented as a fact.

## Economic gate

The canonical first milestone for product 3000 is:

ONE_REAL_EXTERNAL_PAYMENT = true

Required evidence:

- payment settled
- payment associated with 3000
- allocation exists
- allocation does not overlap another allocation
- content review state is recorded
- public placement is published after approval
- proof artifact is committed to GitHub

Until all required evidence exists:

REVENUE_PROVEN = false

## Anti-self-deception rule

Code completion, deployment completion, page views, clicks, AI confidence, market research, or ChatGPT assertions do not count as revenue.

## Approval rule

The system may propose public actions.

The system must not publish externally without explicit human approval.

## Cadence

Truth pulse: twice daily.

Local Cortex may ingest and analyze more frequently.

Each pulse writes a dated proof artifact and commits it to GitHub.

## Recovery

If the local computer is offline, GitHub Actions continues the public truth pulse.

If ChatGPT is unavailable, the repository remains the canonical record.

If GitHub Actions is unavailable, local Cortex can run the same verifier against the repository and live APIs.

## Current commercial objective

3000 -> one stranger -> NZ$50 -> settled payment -> approved placement.

No new product family is authorized by this document until the first economic gate is passed.
