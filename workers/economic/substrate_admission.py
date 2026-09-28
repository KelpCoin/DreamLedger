#!/usr/bin/env python3
"""Bridge an existing economic compute trace into substrate admission.

This adapter is deliberately side-effect free. It does not authorize actions,
write economic truth, create transactions, or invent missing cost/dependency data.
"""
from substrate_survival_gate import evaluate


def assess_trace(
    trace,
    *,
    alternative_valid=False,
    reprice_required=False,
    insurance_required=False,
    coverage_available=True,
    uninsured_material=False,
    substrate_expired=False,
):
    """Return an admission decision reconstructed from an execution trace.

    Required trace facts are read-only observations. Missing material cost or
    dependency evidence remains explicit rather than being treated as zero or
    safe.
    """
    trace = trace or {}

    cost_status = trace.get("cost_status") or trace.get("compute_cost_status")
    material_cost_unknown = cost_status in (None, "UNKNOWN", "UNRECORDED")

    worker_status = trace.get("worker_resource_status")
    dependency_failed = worker_status in ("FAILED", "EXHAUSTED", "CONSTRAINED")

    if trace.get("failure_class") in (
        "DEPENDENCY_FAILURE",
        "WORKER_RESOURCE_LIMIT",
        "WORKER_FAILURE",
        "PROVIDER_FAILURE",
    ):
        dependency_failed = True

    decision = evaluate(
        dependency_failed=dependency_failed,
        alternative_valid=alternative_valid,
        reprice_required=reprice_required,
        insurance_required=insurance_required,
        coverage_available=coverage_available,
        uninsured_material=uninsured_material,
        material_cost_unknown=material_cost_unknown,
        substrate_expired=substrate_expired,
    )

    return {
        "admission": decision,
        "economic_trace_id": trace.get("economic_trace_id"),
        "action_id": trace.get("action_id"),
        "opportunity_id": trace.get("opportunity_id"),
        "dependency_failed": dependency_failed,
        "material_cost_unknown": material_cost_unknown,
        "source": "ECONOMIC_COMPUTE_TRACE",
    }
