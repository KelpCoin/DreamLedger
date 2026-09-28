"""One-row-at-a-time production observation contract.

This module consumes only caller-supplied persisted rows. It never invents a
row, writes Supabase, authorizes an action, or promotes an outcome.
"""
from __future__ import annotations

from typing import Any

from event_projection import project_action, project_payment, project_verification
from state_transition_engine import transition_opportunity


def observe_action(row: dict[str, Any]) -> dict[str, Any]:
    events = project_action(row)
    state = str(row.get("opportunity_state") or "").upper()

    if not state:
        return {
            "result": "EXACT_BLOCKER",
            "error_class": "DATA_FAILURE",
            "dependency_state": "OBSERVED_ROW_INCOMPLETE",
            "missing_field": "opportunity_state",
            "state_before": None,
            "events": events,
        }

    for candidate in events:
        decision = transition_opportunity(
            state,
            candidate["event_type"],
            row.get("transition_context") or {},
        )
        if decision.state_after:
            return {
                "result": "NEXT_STATE",
                "event_type": candidate["event_type"],
                "state_before": state,
                "state_after": decision.state_after,
                "events": events,
            }
        if decision.error_class:
            return {
                "result": "EXACT_BLOCKER",
                "event_type": candidate["event_type"],
                "state_before": state,
                "error_class": decision.error_class,
                "dependency_state": decision.dependency_state,
                "missing_field": decision.missing_field,
                "events": events,
            }

    return {
        "result": "EXACT_BLOCKER",
        "error_class": "NO_TRANSITIONABLE_EVENT",
        "dependency_state": "OBSERVED_NO_ADVANCEMENT",
        "state_before": state,
        "events": events,
    }


def observe_payment(row: dict[str, Any]) -> dict[str, Any]:
    events = project_payment(row)
    return {
        "result": "OBSERVATION_ONLY",
        "events": events,
        "economic_truth_advance": False,
    }


def observe_verification(flags: dict[str, bool]) -> dict[str, Any]:
    events = project_verification(**flags)
    return {
        "result": "NEXT_STATE" if events else "EXACT_BLOCKER",
        "events": events,
        "verified": bool(events),
    }
