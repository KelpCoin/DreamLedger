"""Bounded BECK execution harness with an injected atomic store.

This module is a contract for the executor boundary, not a production adapter.
Production use requires a reviewed persistent store and trusted authority verifier.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Callable, Protocol

from policy import evaluate_intent


class ExecutionStore(Protocol):
    """Persistence boundary. Implementations must make reserve/complete atomic."""

    def reserve(self, key: str, fingerprint: str) -> tuple[str, dict[str, Any] | None]:
        """Return ('NEW', None), ('REPLAY', prior result), or a fail-closed status."""
        ...

    def complete(
        self, key: str, fingerprint: str, result: dict[str, Any], evidence: dict[str, Any]
    ) -> None:
        """Atomically persist result and evidence before returning."""
        ...

    def record_evidence(self, evidence: dict[str, Any]) -> None:
        """Persist a deny/failure evidence record before returning."""
        ...


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _evidence(report: dict[str, Any]) -> dict[str, Any]:
    payload = _canonical(report)
    return {
        **report,
        "evidence_sha256": hashlib.sha256(payload.encode("utf-8")).hexdigest(),
    }


def execute_intent(
    intent: dict[str, Any],
    authority: dict[str, Any] | None,
    contract: dict[str, Any],
    store: ExecutionStore,
    actions: dict[tuple[str, str], Callable[[dict[str, Any]], Any]],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Evaluate, reserve idempotency, run exactly one registered action, and persist evidence."""
    now = now or datetime.now(timezone.utc)
    decision = evaluate_intent(intent, authority, contract, now=now)
    if decision.get("decision") != "ALLOW":
        report = _evidence({
            **decision,
            "execution_state": "NOT_DISPATCHED",
            "result": None,
        })
        store.record_evidence(report)
        return report

    fingerprint = str(decision["intent_fingerprint"])
    key = str(intent["idempotency_key"])
    status, prior = store.reserve(key, fingerprint)
    if status == "REPLAY" and isinstance(prior, dict):
        return {**prior, "replayed": True}
    if status != "NEW":
        report = _evidence({
            **decision,
            "decision": "DENY",
            "reason_codes": ["IDEMPOTENCY_" + str(status)],
            "execution_state": "NOT_DISPATCHED",
            "result": None,
        })
        store.record_evidence(report)
        return report

    action = actions.get((str(intent["action_type"]), str(intent["target"])))
    if action is None:
        report = _evidence({
            **decision,
            "decision": "DENY",
            "reason_codes": ["ACTION_ADAPTER_NOT_REGISTERED"],
            "execution_state": "NOT_DISPATCHED",
            "result": None,
        })
        store.record_evidence(report)
        return report

    try:
        result = action(intent["payload"])
        report = _evidence({
            **decision,
            "execution_state": "TEST_ACTION_COMPLETED",
            "result": result,
        })
        store.complete(key, fingerprint, report, report)
        return report
    except Exception as exc:
        report = _evidence({
            **decision,
            "decision": "DENY",
            "reason_codes": ["ACTION_FAILED"],
            "execution_state": "UNKNOWN",
            "result": None,
            "error_type": type(exc).__name__,
        })
        store.record_evidence(report)
        return report
