#!/usr/bin/env python3
"""Deterministic substrate survival/admission evaluation.

Pure decision logic only. It does not authorize execution, mutate economic truth,
or create transactions.
"""

STATES = {
    "UNASSESSED",
    "SURVIVES",
    "SURVIVES_WITH_REPRICE",
    "SURVIVES_WITH_REROUTE",
    "BLOCKED_BY_SUBSTRATE",
    "HUMAN_REVIEW_REQUIRED",
    "EXPIRED_REASSESSMENT",
}

def evaluate(*, dependency_failed=False, alternative_valid=False,
             reprice_required=False, insurance_required=False,
             coverage_available=True, uninsured_material=False,
             material_cost_unknown=False, substrate_expired=False):
    if substrate_expired:
        return "EXPIRED_REASSESSMENT"

    if insurance_required and not coverage_available and uninsured_material:
        return "HUMAN_REVIEW_REQUIRED"

    if material_cost_unknown:
        return "EXPIRED_REASSESSMENT"

    if dependency_failed:
        if alternative_valid:
            return "SURVIVES_WITH_REROUTE"
        return "BLOCKED_BY_SUBSTRATE"

    if reprice_required:
        return "SURVIVES_WITH_REPRICE"

    return "SURVIVES"
