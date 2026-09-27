# Governance Security Hardening

Branch: `batch14-governance-security-20260927`

## Purpose

This branch closes two independently observed governance gaps without creating fake economic outcomes:

1. exposed security-sensitive tables are fail-closed;
2. economic source exclusions are enforced at packet creation and dispatch rather than by individual opportunity IDs.

No production migration or external action is performed by this branch.

## Economic exclusion invariant

The canonical rule is:

`excluded source/category -> RED -> authorized=false -> human_approval_required=true -> no actuator dispatch`

The exclusion table is deliberately source-oriented. The initial rule is `%n8n%`, so a newly observed n8n source does not need a new opportunity-specific block.

The gate checks:

- explicit `source`;
- `source_ref`;
- `channel`;
- metadata.source;
- category patterns where configured.

Packet creation records a durable BLOCKED packet for an excluded source rather than silently dropping the request.

Dispatch performs the same check again. This protects against stale or manually-mutated packets.

## RLS hardening

The live audit found seven exposed tables with RLS disabled:

- pre_registrations
- evidence_graph_edges
- gauntlet_certificates
- gauntlet_policy_registry
- silo_factory_batches
- company_autopilot_state
- company_autopilot_runs

The migration:

- revokes direct anon/authenticated table privileges;
- enables RLS;
- forces RLS;
- adds explicit service-role policies.

This is intentionally fail-closed. Purpose-specific user-facing policies should be added only after the legitimate access path for each table is documented and tested.

## Commerce view

The migration sets `security_invoker = on` on `commerce_order_operations` when the view exists. The commerce migration should continue to create this property explicitly.

## BECK capability finding

The live `bec_capability_registry` currently contains a generic `beck-execution` capability:

- display: BECK Execution
- source: `supabase:jobs`
- external_effect: false
- autonomy_lane: AMBER
- approval_required: true

The registry inspected does not declare a Beauty Academy silo binding. Therefore the capability is not evidence of authorization for Peggy's private Academy. Name similarity is not a binding.

The next architectural step is an explicit capability-to-silo binding contract. Until that exists, private Academy code must not infer authority from `beck-*` names.

## Truth boundary

This work does not change:

- VERIFIED_EXTERNAL_REVENUE;
- settled external payments;
- independent external buyers;
- fulfillment evidence;
- verified external outcomes.

All remain governed by observed external evidence.

## Runtime status

Schema and tests are implemented in this branch.

Live production application: NOT APPLIED.

The remaining live work requires deliberate migration review, then deployment, then security-advisor recheck and regression execution.
