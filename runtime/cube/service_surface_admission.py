"""Admission checks for candidate customer-facing surfaces.

Pure validation only. It does not authorize commerce and cannot create revenue.
It answers one question: does an already-existing capability have the minimum
declared contract needed to be considered a service-wall candidate?
"""

from __future__ import annotations

from typing import Any, Mapping


REQUIRED_WALL_STAGES = (
    "BUYER",
    "PAYMENT_SETTLED",
    "ENTITLEMENT",
    "SERVICE_WALL",
    "EXISTING_CAPABILITY",
    "RESULT",
    "EVIDENCE",
)


def admit(surface: Mapping[str, Any]) -> dict[str, Any]:
    failures: list[str] = []

    path = tuple(surface.get("economic_path", ()))
    if path != REQUIRED_WALL_STAGES:
        failures.append("economic_path_must_match_existing_wall_contract")

    if not surface.get("capability_id"):
        failures.append("capability_id_missing")

    if not surface.get("inputs"):
        failures.append("inputs_missing")

    if not surface.get("outputs"):
        failures.append("outputs_missing")

    if not surface.get("validation"):
        failures.append("validation_missing")

    if surface.get("automated_delivery_allowed") and surface.get("human_gate_required"):
        failures.append("automated_delivery_conflicts_with_human_gate")

    if surface.get("automation") != "FULL" and surface.get("automated_delivery_allowed"):
        failures.append("partial_capability_cannot_be_automated")

    status = "ADMITTED_CANDIDATE" if not failures else "BLOCKED"
    return {
        "status": status,
        "service_id": surface.get("service_id"),
        "capability_id": surface.get("capability_id"),
        "failures": failures,
        "revenue_truth": "NOT_ASSERTED",
    }
