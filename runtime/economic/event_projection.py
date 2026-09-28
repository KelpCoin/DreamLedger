"""Deterministic projection from persisted economic records to canonical event candidates.

Read-only by design. It never writes economic truth, authorizes external action,
or promotes incomplete observations to verified outcomes.
"""

from __future__ import annotations

from typing import Any


def project_action(row: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    state = str(row.get("status") or row.get("state") or "").upper()
    dispatch = str(row.get("dispatch_state") or "").upper()
    authorization = str(row.get("authorization_verdict") or "").lower()

    if state in {"PREPARED", "READY"}:
        events.append({"event_type": "ACTION_PREPARED"})
    if authorization == "allow":
        events.append({"event_type": "ACTION_AUTHORIZED"})

    if dispatch == "INTERNAL_ROUTED":
        events.append({"event_type": "ACTION_DISPATCHED", "state_after": "INTERNAL_ROUTED"})
    elif dispatch == "EXTERNAL_BLOCKED":
        events.append({"event_type": "ACTION_BLOCKED", "state_after": "EXTERNAL_BLOCKED"})
    elif dispatch == "EXTERNAL_SENT":
        events.append({"event_type": "EXTERNAL_ACTION_SENT"})
    elif dispatch == "EXTERNAL_RESULT_OBSERVED":
        events.append({"event_type": "EXTERNAL_RESULT_OBSERVED"})

    return events


def project_payment(row: dict[str, Any]) -> list[dict[str, Any]]:
    status = str(row.get("status") or row.get("payment_status") or "").upper()
    events: list[dict[str, Any]] = []

    if status in {"CHECKOUT_STARTED", "CHECKOUT_CREATED"}:
        events.append({"event_type": "CHECKOUT_STARTED"})
    elif status in {"PROCESSING", "REQUIRES_ACTION", "ATTEMPTED"}:
        events.append({"event_type": "PAYMENT_ATTEMPTED"})
    elif status in {"FAILED", "CANCELED", "CANCELLED"}:
        events.append({"event_type": "PAYMENT_FAILED"})
    elif status in {"SUCCEEDED", "SETTLED"}:
        events.append({"event_type": "PAYMENT_SETTLED"})

    return events


def verification_ready(
    *,
    independent_buyer: bool,
    settled_payment: bool,
    fulfilled: bool,
    evidence: bool,
    predicate_passed: bool,
) -> bool:
    return all(
        (
            independent_buyer,
            settled_payment,
            fulfilled,
            evidence,
            predicate_passed,
        )
    )


def project_verification(**flags: bool) -> list[dict[str, Any]]:
    if verification_ready(**flags):
        return [{"event_type": "ECONOMIC_OUTCOME_VERIFIED"}]
    return []
