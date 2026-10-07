# DreamLedger Economic Immune System

Status: DESIGN_LOCKED / EXECUTION_READY
Date: 2026-10-07

## Purpose

Prevent uncounterfactualised economic observations from becoming recursive inputs to monetization, vector clustering, phenotype generation, or replication.

The authoritative economic truth boundary remains Supabase/DreamLedger. Local SQLite, LM Studio, Airtable, Notion, GitHub, logs, and simulations are non-authoritative supporting surfaces.

## Seven-question Epistemic Immune Gate

Every observation must carry:

1. Provenance
2. Independence
3. Authority
4. Causality
5. Settlement
6. Fulfillment
7. Reproducibility

These questions qualify evidence. They do not permit a webhook, model inference, test event, or internal simulation to become VERIFIED_EXTERNAL_REVENUE.

## Economic state sequence

RECEIVED -> AUTHORIZED -> PAID -> SETTLED -> FULFILLED -> EVIDENCED -> VERIFIED -> REPLICABLE

A Stripe webhook is an observation of an external event. It is not by itself proof of settlement, fulfillment, or verification.

## Economic Opportunity

Economic Velocity:
V = Money × Urgency × Pain × Authority × Deliverability

Economic Opportunity:
EO = V × Evidence Quality × Independence × Reproducibility

Generate cheaply. Test cheaply. Replicate only after strong independent evidence.

## Vector contamination rule

Unqualified observations may be stored for analysis but must have zero replication authority and zero meaningful influence on high-confidence economic centroids.

Evidence-weighted vector influence is a design target, not yet a production implementation.

Do not implement a new PGVector/vector subsystem until the existing economic observation schema is inspected and the Supabase PostgreSQL connection is restored.

## Artifact Contamination Depth

When an observation becomes CONTRADICTED or materially downgraded, trace its descendants:

observation -> cell -> offer -> phenotype -> surface -> decision

Calculate contamination depth and quarantine downstream replication eligibility. Recompute affected analytical clusters from uncorrupted observations rather than silently editing historical truth.

## Required implementation order

1. Restore PostgreSQL connectivity.
2. Inspect existing DreamLedger/economic observation tables.
3. Trace Stripe live events into the existing observation contract.
4. Identify existing lineage/evidence fields before adding anything.
5. Add the smallest missing schema only if required.
6. Implement evidence scoring as derived state, not mutable historical truth.
7. Add contamination/lineage queries.
8. Only then consider geometric weighting.
9. Verify with real external transaction evidence.
10. Keep VERIFIED_EXTERNAL_REVENUE at NZ$0.00 until the full evidence chain is independently satisfied.

## Explicit non-goals

No parallel ledger.
No local SQLite economic authority.
No automatic promotion from checkout to VERIFIED.
No replication based on traffic volume alone.
No mass phenotype generation merely because compute is available.
No new application architecture while the authoritative database connection is unavailable.
