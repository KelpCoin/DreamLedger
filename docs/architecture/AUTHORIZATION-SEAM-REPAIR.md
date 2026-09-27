# Authorization Seam Repair

Branch: batch14-authz-seam-20260927

This change collapses the economic authorization decision into one database Policy Decision Point.

PEP -> evaluate_economic_authorization() -> policy/exclusion decision -> obligation -> actuator

The exclusion gate remains first and non-overridable. The PDP checks economic_exclusions before the active economic_authority_policies row.

Decision semantics:
- ALLOW: policy permits the action without an approval obligation.
- NEEDS_APPROVAL: policy permits only after a human approval obligation is satisfied.
- DENY: policy or exclusion blocks the action.
- Excluded sources are always DENY; approval cannot override the exclusion.

The legacy authorize_economic_action() function is retained as a compatibility wrapper only. It delegates to evaluate_economic_authorization() and no longer owns independent policy logic. Existing callers such as the operating tick therefore cannot create a second authorization universe merely by continuing to call the legacy function.

economic-activation is updated in the branch to call the canonical PDP directly. It cannot promote a packet to AUTHORIZED unless the PDP returns ALLOW.

Human approval is also governed by the PDP. economic_consume_action_authorization() now re-evaluates the packet after the approval credential is presented and before the packet becomes AUTHORIZED. An excluded source therefore remains denied even if an approval credential exists.

Security hardening:
- check_source_exclusion() is executable only by service_role.
- evaluate_economic_authorization() is executable only by service_role.
- authorize_economic_action() is executable only by service_role.
- Approval issuer/consumer functions are executable only by service_role.
- economic_exclusions is readable by service_role but has no direct mutation grant to API or service-role callers. Changes are therefore an operator/database migration responsibility.
- The seven internal-only tables retain RLS, revoked API grants, and explicit API-deny policies.
- Every public-schema view is set to security_invoker = on.

Tests cover:
1. excluded source -> DENY/SOURCE_EXCLUDED;
2. permitted SEND_OUTREACH -> NEEDS_APPROVAL;
3. permitted internal BUILD_EXECUTION_PACKET -> existing policy ALLOW;
4. SECURITY DEFINER PDP/exclusion execution is not exposed to API/public roles;
5. all seven internal tables have RLS and explicit API-deny policies;
6. every public view is security-invoker;
7. approval consumption calls the canonical PDP and fails closed after a PDP denial;
8. the legacy authorization function delegates to the PDP;
9. the economic-outcomes evidence boundary columns remain present.

Production status: not applied. No external action, payment, fulfillment, or revenue claim is created by this branch.