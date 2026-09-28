"""Mechanical economic state transitions.

This module consumes canonical event candidates and returns either the next
state or an exact blocker. It does not perform external actions or mutate
economic truth.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Transition:
    state_after: str | None
    event_type: str
    error_class: str | None = None
    dependency_state: str | None = None
    missing_field: str | None = None


def transition_opportunity(state: str, event: str, context: dict[str, Any]) -> Transition:
    state = state.upper()
    event = event.upper()

    if state == "DISCOVERED" and event == "DEMAND_QUALIFIED":
        if context.get("legitimacy_ok") and context.get("jurisdiction_ok"):
            return Transition("QUALIFIED", event)
        return Transition(None, "ACTION_BLOCKED", "LEGAL_FAILURE", "blocked", "legitimacy_or_jurisdiction")

    if state == "QUALIFIED" and event == "DECOMPOSE_COMPLETE":
        if context.get("deliverables"):
            return Transition("DECOMPOSED", event)
        return Transition(None, "ACTION_BLOCKED", "DATA_FAILURE", "blocked", "deliverables")

    if state == "DECOMPOSED" and event == "CAPABILITY_MATCHED":
        if context.get("all_deliverables_capable"):
            return Transition("CAPABILITY_MATCHED", event)
        return Transition(None, "ACTION_BLOCKED", "CAPACITY_FAILURE", "blocked", "capability")

    if state == "CAPABILITY_MATCHED" and event == "TRAVERSABLE":
        required = ("access_confirmed", "authority_confirmed", "validation_ready",
                    "settlement_path_confirmed", "delivery_path_confirmed")
        missing = next((k for k in required if not context.get(k)), None)
        if missing is None:
            return Transition("TRAVERSABLE", event)
        return Transition(None, "ACTION_BLOCKED", "ACCESS_FAILURE" if missing == "access_confirmed"
                          else "AUTHORITY_FAILURE" if missing == "authority_confirmed"
                          else "STRUCTURAL_UNAVAILABILITY", "blocked", missing)

    if state == "TRAVERSABLE" and event == "ACTION_AUTHORIZED":
        if context.get("authorization_granted"):
            return Transition("AUTHORIZED", event)
        return Transition(None, "ACTION_BLOCKED", "AUTHORITY_FAILURE", "blocked", "authorization_granted")

    if state == "AUTHORIZED" and event == "ACTION_DISPATCHED":
        if context.get("worker_trace"):
            return Transition("EXECUTED", event)
        return Transition(None, "ACTION_BLOCKED", "DEPENDENCY_FAILURE", "unverified", "worker_trace")

    if state == "EXECUTED" and event == "PAYMENT_SETTLED":
        if context.get("independent_buyer") and context.get("settlement_evidence"):
            return Transition("PAID", event)
        missing = "independent_buyer" if not context.get("independent_buyer") else "settlement_evidence"
        return Transition(None, "ACTION_BLOCKED", "SETTLEMENT_FAILURE", "unverified", missing)

    if state == "PAID" and event == "FULFILLMENT_COMPLETED":
        if context.get("all_deliverables_complete"):
            return Transition("FULFILLED", event)
        return Transition(None, "ACTION_BLOCKED", "CAPACITY_FAILURE", "blocked", "all_deliverables_complete")

    if state == "FULFILLED" and event == "ECONOMIC_OUTCOME_VERIFIED":
        required = ("payment_settled", "fulfillment_complete", "evidence_joined", "verification_passed")
        missing = next((k for k in required if not context.get(k)), None)
        if missing is None:
            return Transition("VERIFIED", event)
        return Transition(None, "ACTION_BLOCKED", "DATA_FAILURE", "unverified", missing)

    return Transition(None, "ACTION_BLOCKED", "STATE_TRANSITION_INVALID", "blocked", f"{state}:{event}")
