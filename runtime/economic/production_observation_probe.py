"""Read-only probe contract for one real production observation.

The probe deliberately accepts a supplied production row and produces only a
transition decision. It is not a database writer and cannot manufacture rows.
"""
from __future__ import annotations

from typing import Any

from event_projection import project_action, project_payment
from state_transition_engine import transition_opportunity


def inspect_action(row: dict[str, Any]) -> dict[str, Any]:
    action_type = str(row.get("action_type") or "").upper()
    events = project_action(row)
    current = str(row.get("opportunity_state") or "").upper()

    if action_type == "BUILD_EXECUTION_PACKET":
        return {
            "result": "EXACT_BLOCKER",
            "error_class": "INTERNAL_PLANNING_ACTION",
            "dependency_state": "OBSERVED_INTERNAL_ROUTING",
            "missing_field": "external_economic_action",
            "events": events,
        }
    if not current:
        return {
            "result": "EXACT_BLOCKER",
            "error_class": "DATA_FAILURE",
            "missing_field": "opportunity_state",
            "events": events,
        }

    for event in events:
        transition = transition_opportunity(
            current,
            event["event_type"],
            row.get("transition_context") or {},
        )
        if transition.state_after:
            return {
                "result": "NEXT_STATE",
                "event_type": event["event_type"],
                "state_before": current,
                "state_after": transition.state_after,
                "events": events,
            }
        if transition.error_class:
            return {
                "result": "EXACT_BLOCKER",
                "event_type": event["event_type"],
                "state_before": current,
                "error_class": transition.error_class,
                "dependency_state": transition.dependency_state,
                "missing_field": transition.missing_field,
                "events": events,
            }

    return {
        "result": "EXACT_BLOCKER",
        "error_class": "NO_TRANSITIONABLE_EVENT",
        "dependency_state": "unverified",
        "events": events,
    }


def inspect_payment(row: dict[str, Any]) -> dict[str, Any]:
    events = project_payment(row)
    return {
        "result": "OBSERVATION_ONLY",
        "events": events,
        "warning": "Payment observation is not revenue verification.",
    }
