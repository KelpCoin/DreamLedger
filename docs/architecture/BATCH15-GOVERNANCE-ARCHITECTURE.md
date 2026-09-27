# Batch 15: Governance Architecture

Status: IMPLEMENTED IN GITHUB BRANCH, NOT APPLIED TO PRODUCTION

Branch: batch15-governance-authzen-20260927

## Decision seam

The canonical authorization function is:

public.evaluate_economic_authorization(subject, action, resource, context)

It records an immutable-ish decision row with:
- decision_id
- trace_id
- request_hash
- SARC inputs
- verdict: allow | deny | needs_approval
- policy version
- reasons and obligations
- authority chain
- spend limit and requested cost

This follows the AuthZEN Authorization API model. AuthZEN separates the PEP from the PDP and its COAZ work maps protocol-specific inputs into Subject, Action, Resource, Context.

## Non-bypassability

economic_execution_packets now carry the PDP decision, trace, verdict, and request hash.

A database trigger blocks AUTHORIZED packets unless:
1. a real PDP decision exists;
2. the decision verdict is allow;
3. the decision request hash recomputes correctly;
4. the packet trace and request hash match the decision;
5. authority_policy.authorized is true.

This is the important part. A caller can no longer merely write AUTHORIZED into the packet row.

Packet creation is routed through evaluate_economic_authorization(). The older authorize_economic_action() function remains the underlying policy-store evaluator, not a second packet authorization door.

## Human approval

economic_issue_action_authorization() now re-evaluates the exact packet through the PDP before issuing an approval credential. Approval is therefore an obligation, not a policy bypass.

The resulting authorization record stores the PDP decision and trace identifiers.

## Authority attenuation

economic_authority_delegations models:
- parent and child principal
- child scope versus parent scope
- child spend versus parent spend
- delegation depth versus parent maximum
- validity and revocation
- chain hash

Database checks enforce the numeric attenuation constraints. Scope attenuation is represented explicitly and is additionally checked by the PDP when an authority_scope is supplied.

The human principal remains the intended root of the delegation chain. No model or agent is granted authority merely because it can propose an action.

## Evidence boundary

economic_outcomes cannot be marked VERIFIED unless metadata.evidence_claims contains all thirteen required claims:
1. artifact_integrity
2. temporal_existence
3. provenance
4. approval_evidence
5. declared_ordering
6. capture_claim
7. relevance_claim
8. deliberation_traceability
9. monitoring_claim
10. anchoring_authorization_claim
11. policy_assessment_claim
12. risk_treatment_claim
13. mitigation_implementation_claim

This does not create evidence. It only prevents incomplete evidence from being represented as VERIFIED.

## RLS

The seven previously hardened security-sensitive tables receive explicit rejection policies for anon and authenticated in addition to revoked grants and FORCE RLS.

## Security-definer audit

Live inspection before this branch showed:
- 185 public SECURITY DEFINER functions.
- 0 with no search_path configuration.
- Many older functions intentionally use search_path='' and therefore are already pinned to an empty path.
- The relevant economic authorization functions use explicit paths.
- Batch 15 pins check_source_exclusion() to public, pg_temp.

This is more precise than treating every function that does not use public, pg_temp as vulnerable. search_path='' is a valid fail-closed configuration.

## The remaining live gap

economic-activation is still deployed as an older Edge Function that directly calls authorize_economic_action() and mutates packet state.

Batch 15 makes the database the enforcement boundary: an unauthorized direct attempt to promote a packet to AUTHORIZED is rejected by the packet trigger.

The next implementation step is to update the economic-activation Edge Function itself so that it calls the canonical PDP and writes the returned decision identifiers, rather than relying on the database trigger as its normal path.

The same applies to agent-bridge-proxy: the transport boundary should call the canonical PDP before any actuator dispatch.

No Edge Function deployment is performed by this branch.

## Truth status

Verified external revenue remains NZ$0.00.

This branch creates governance evidence and enforcement. It does not create a buyer, settled payment, fulfillment, or verified external economic outcome.
