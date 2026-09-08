# Day 1 Admission Control Execution Receipt

Date: 2026-09-08
Status: IMPLEMENTED AND VERIFIED

## Changes applied in Supabase

Project: `wbwgroygjeyukkspnqiy`

`control_plane_publication_admissions` now carries:

- `capability_scope`
- `delegation_chain`
- `policy_compliance`
- `execution_token_hash`
- `execution_token_expires_at`
- `execution_token_consumed_at`

A privileged `control_plane_issue_admission(...)` RPC now requires explicit capability scope, delegation provenance, and policy-compliance data. Successful admissions receive a short-lived execution token; only its SHA-256 hash is persisted.

A privileged `control_plane_consume_execution_token(...)` RPC validates exact admission ID, exact candidate SHA-256, token hash, admission state, expiry, and single-use state before marking the token consumed.

The admission, token-consumption, and Truth Oracle context SECURITY DEFINER functions have their `search_path` pinned to the empty path and are no longer executable by `anon` or `authenticated`; execution is restricted to `service_role`.

The Truth Oracle context retrieval was corrected so a `BrownEye`/`BECK` subject retrieves the canonical related `CONTROL_PLANE`, `ELOHIM`, `TRUTH_ORACLE`, and `GAUNTLET` claims/evidence instead of returning an empty epistemic context.

## Verification

A transaction-scoped integration probe successfully:

1. issued an `ALLOW` admission with explicit capability/delegation/policy data;
2. received an execution token;
3. consumed the token successfully through the execution authorization RPC; and
4. rolled the transaction back.

Therefore no synthetic admission receipt was persisted.

The BrownEye context probe now returns 5 claims for the `BrownEye` subject instead of the previous empty claim set.

## Remaining Day 1 boundary

This proves the admission-control primitives, not a production admission. A real production `ALLOW` still requires a real Oracle run, real Gauntlet PASS, complete evidence, and CI verification bound to the exact candidate SHA.

The next operating step is Day 2: evidence-bound Truth Oracle execution.
