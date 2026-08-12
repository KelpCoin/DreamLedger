# HUMANISER / GAUNTLET v2

Purpose: prevent external-facing products from shipping with avoidable machine-only voice or unreviewed claims.

## POLICY

EXTERNAL_PRODUCTS = HUMANISER_REQUIRED
MIN_HUMAN_FOOTPRINTS = 2
ROBOT_SMELL = ERODED

## PIPELINE

Gauntlet: Atomize -> Attack -> Invert -> Rebuild -> PASS/FAIL
LM Studio: refine draft
Humaniser: two distinct human review passes
Approval Gate: explicit ship decision
Fossil: evidence of completion / payment

## HUMAN FOOTPRINT

A human footprint is a substantive edit, correction, selection, or judgment recorded against the artifact. A passive glance does not count.

Each footprint records reviewer role, timestamp, artifact hash or SKU, and summary of the change.

For external products, fewer than two substantive human footprints is a Gauntlet failure.

## TRUTH RULE

Humanisation may improve clarity, specificity, texture and trust. It must never introduce fabricated testimonials, rankings, buyers, transactions, performance claims, certifications or evidence.

Internal tools may remain machine-oriented. This policy applies to external products and public-facing commerce artifacts.

## COMMERCIAL LOOP

Demand -> draft -> Gauntlet -> Humaniser x2 -> approval -> ship -> Fossil

The Humaniser is a quality gate, not a claim generator.
