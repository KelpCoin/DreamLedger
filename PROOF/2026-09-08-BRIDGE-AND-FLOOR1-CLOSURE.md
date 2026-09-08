# Live Bridge and Kelplantis Floor 1 Closure Proof

Date: 2026-09-08
Project: DreamLedger / Supabase wbwgroygjeyukkspnqiy

## VERIFIED FACTS

- `public.prospecting_candidates` exists and is RLS protected.
- `public.prospecting_candidates_audit` existed with RLS disabled before this change.
- RLS is now enabled on `public.prospecting_candidates_audit`.
- No public/authenticated policy was added to the audit table.
- `public.prospecting_candidates` uses `approval_status`; observed live rejected candidates exist.
- `trg_guard_economic_candidate_fail_closed` is installed on `public.prospecting_candidates`.
- The guard function is `public.guard_economic_candidate_fail_closed()`.
- A synthetic rejected candidate transition from `rejected` to `approved` was attempted and was rejected by the database with the fail-closed exception.
- A synthetic pending candidate was transitioned to `approved` successfully, then deleted.
- No production candidate was modified by the attack test.
- The live database already contains the economic bridge tables: `economic_scan_runs`, `economic_model_tasks`, `economic_candidate_assessments`, `economic_disagreements`, `economic_events`, `economic_outcomes`, `economic_truth_ledger`, `economic_actions`, `economic_calibration`, `truth_oracle_releases`, `control_events`, `control_evidence`, and `control_reconciliations`.
- The live database already contains the Kelplantis authoritative progression surface `kelplantis_floor_progression`.
- The live database already exposes authoritative gameplay routines for player creation, floor entry, movement, encounter engagement, attack, Floor 1 boss clear, floor gate lookup, floor progress lookup, and world-state lookup.

## NEGATIVE-TRUTH TEST

Synthetic record:
`00000000-0000-0000-0000-000000000901`

Initial state:
`approval_status = rejected`

Attack:
`approval_status = approved`

Observed result:
Database rejected the transition with:
`economic bridge fail-closed: rejected/failed candidate cannot advance to action/approval state`

Cleanup:
Synthetic record deleted.

## LEGITIMATE-PATH TEST

Synthetic record entered as:
`approval_status = pending_human_review`

Transition:
`pending_human_review -> approved`

Observed result:
`approval_status = approved`

Cleanup:
Synthetic record deleted.

## REMAINING ECONOMIC PROOF GAP

RA_000001 remains open unless independently verified by the existing payment/reconciliation controls. No database write in this proof promotes RA_000001.

## REMAINING IMPLEMENTATION GAP

The GitHub main branch historically did not contain all migration files represented in the live Supabase migration history. This closure therefore records the two newly applied migrations in Git, but the repository still needs reconciliation of the complete remote migration history before it can be treated as a byte-for-byte migration source of truth.

## KELPLANTIS

The live Supabase project already contains the authoritative Floor 1 progression and deterministic gameplay primitives. The next development task is client integration and end-to-end player verification, not another backend architecture rewrite.
