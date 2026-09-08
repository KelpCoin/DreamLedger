# BECK Event Graph + Economic Prediction Layer

Status: FOUNDATION IMPLEMENTED
Date: 2026-09-08

## Purpose

Turn authoritative world and economic events into durable graph relationships, recurring patterns, and calibrated predictions without allowing prediction to become authority.

## Plane boundary

Event observation belongs to the Evidence/Data substrate.
Pattern detection produces observations.
Prediction produces hypotheses.
Elohim may turn predictions into proposals.
Truth Oracle verifies evidence.
Gauntlet attacks proposed actions.
Economic admission decides whether an economic mutation is permitted.
Execution performs only an admitted action.

A prediction can never authorize itself.

## Existing authoritative event sources

- `kelplantis_events`: world/game events.
- `economic_events`: verified economic activity and payment/fulfilment state.
- `event_ledger`: append-only economic ledger.
- `economic_demand_signals`: observed external demand.
- `economic_outcomes`: realized economic outcomes.

## Graph primitives

`economic_event_graph_edges` stores relationships between observed events.

Supported relations:

- PRECEDED_BY
- FOLLOWED_BY
- CORRELATED_WITH
- SAME_ACTOR
- SAME_LOCATION
- SAME_SKU
- SAME_OPPORTUNITY
- SAME_CLUSTER
- RESULTED_IN
- CAUSED_BY

`CAUSED_BY` is reserved for causality supported by evidence. Statistical association must remain `CORRELATED_WITH`.

## Pattern primitives

`economic_event_patterns` stores recurring sequences, transitions, clusters, community patterns, and economic patterns.

Lifecycle:

OBSERVED -> RISING -> ESTABLISHED -> COOLING -> DORMANT -> RETIRED

Pattern strength is observational evidence, not permission.

## Prediction primitives

`economic_predictions` stores a probability-bearing hypothesis against a defined time window.

Lifecycle:

PREDICTED -> OBSERVED -> CONFIRMED | PARTIAL | WRONG | EXPIRED

Predictions may be QUARANTINED when their evidence or provenance becomes unsafe.

Calibration error is measured after resolution. Historical prediction accuracy therefore becomes evidence for future weighting rather than a hidden model assumption.

## Economic loop

WORLD EVENT -> GRAPH EDGE -> PATTERN -> PREDICTION -> ELOHIM PROPOSAL -> TRUTH ORACLE -> GAUNTLET -> ECONOMIC ADMISSION -> EXECUTION -> OUTCOME -> NEW EVENTS

## Scarcity rule

Prediction proposes supply expansion. Observed economic evidence authorizes it through the existing admission machinery. No model prediction can mint supply directly.

## Security boundary

The three new tables are RLS-enabled and have no anon/authenticated privileges. Writes are service-role only. They are deliberately not exposed as a browser mutation surface.

## Deliberate non-goals

This foundation does not yet implement a secondary marketplace, autonomous issuance, multi-LLM consensus, or runner fallback. Those require evidence from the real commercial loop and must remain behind the existing authority/admission boundary.
