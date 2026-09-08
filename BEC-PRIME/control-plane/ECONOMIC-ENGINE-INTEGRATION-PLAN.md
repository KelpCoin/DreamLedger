# Economic Engine Integration Plan

Status: LIVE BRIDGE HARDENING IN PROGRESS
Date: 2026-09-08

## Authority chain

DISCOVERY -> OFFER MATCH -> GATE VERDICT -> EVIDENCE -> MODEL ASSESSMENTS -> DISAGREEMENT/RECONCILIATION -> TRUTH ORACLE -> HUMAN APPROVAL -> ACTION -> REAL ECONOMIC EVENT -> OUTCOME -> CALIBRATION

Prediction never grants authority.
Model consensus never substitutes for evidence.
A FAIL or HOLD is an economic control-plane result and must remain durable.

## Implemented live closure

1. `public.guard_economic_candidate_fail_closed()` now prevents an existing rejected/failed candidate from transitioning into outreach, approval, actionable, execution, or publication state.
2. `trg_guard_economic_candidate_fail_closed` is attached to `public.prospecting_candidates`.
3. `public.prospecting_candidates_audit` now has RLS enabled with no public/authenticated policy.
4. Synthetic attack and legitimate-path tests were executed against live Supabase and cleaned up.

## Existing live substrate

The live project already contains:

- economic_scan_runs
- prospecting_candidates
- economic_model_tasks
- economic_candidate_assessments
- economic_disagreements
- economic_events
- economic_outcomes
- economic_truth_ledger
- economic_actions
- economic_calibration
- truth_oracle_releases
- control_events
- control_evidence
- control_reconciliations
- revenue_orders
- revenue_entitlements
- fulfillment_requests
- stripe_webhook_events

Existing Truth Oracle, Gauntlet, admission, event graph, prediction, and AgentBridge-related migrations remain authoritative. Do not replace them with parallel systems.

## External patterns

AgentBridge informs scoped tasks and handoffs.
Aragora informs adversarial review and portable decision receipts.
BootProof informs execution provenance.
BECK remains the authority system.

## Execution resilience

After RA_000001 is independently verified:

PRIMARY RUNNER -> HEARTBEAT -> FAILURE CLASSIFICATION -> PRE-AUTHORIZED FALLBACK -> EXECUTION RECEIPT -> ORACLE RECONCILIATION -> LEDGER

Fallback does not grant additional authority and must execute the same admitted candidate under the same admission.

## RA_000001

RA_000001 remains OPEN until a genuine independently verified stranger payment exists. No synthetic test can promote it.

## Kelplantis

Kelplantis is a separate gameplay surface using the same authoritative Supabase project. The live database already contains Floor 1 progression and deterministic gameplay primitives. The next client increment is the playable Floor 1 vertical slice, not another economic architecture rewrite.
