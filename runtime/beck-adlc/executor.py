"""Bounded BECK execution harness with injected trusted-authority and persistence boundaries.

Production adapters are intentionally not supplied here. Test doubles must never be
configured for production. A database transaction cannot atomically roll back an
arbitrary external side effect; uncertain outcomes must remain UNKNOWN until verified.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Callable, Protocol

from policy import evaluate_intent


class AuthorityProvider(Protocol):
    """Trusted boundary: resolve a grant and cryptographically verify it before returning it."""

    def resolve_verified(self, intent: dict[str, Any], contract: dict[str, Any], now: datetime) -> dict[str, Any] | None:
        """Return an authenticated, scope-bound grant or None. Never trust intent-supplied grants."""
        ...


class ExecutionStore(Protocol):
    """Persistence boundary. Production reserve/complete operations must be atomic and durable."""

    def reserve(self, key: str, fingerprint: str) -> tuple[str, dict[str, Any] | None]:
        """Return ('NEW', None), ('REPLAY', prior result), or a fail-closed status."""
        ...

    def complete(self, key: str, fingerprint: str, result: dict[str, Any], evidence: dict[str, Any]) -> None:
        """Atomically persist result and evidence before returning."""
        ...

    def record_evidence(self, evidence: dict[str, Any]) -> None:
        """Persist a deny/failure evidence record before returning."""
        ...


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _evidence(report: dict[str, Any]) -> dict[str, Any]:
    payload = _canonical(report)
    return {**report, "evidence_sha256": hashlib.sha256(payload.encode("utf-8")).hexdigest()}


def execute_intent(
    intent: dict[str, Any],
    contract: dict[str, Any],
    authority_provider: AuthorityProvider,
    store: ExecutionStore,
    actions: dict[tuple[str, str], Callable[[dict[str, Any]], Any]],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Resolve trusted authority, evaluate policy, reserve idempotency, run one action, persist receipt."""
    now = now or datetime.now(timezone.utc)
    try:
        authority = authority_provider.resolve_verified(intent, contract, now)
    except Exception as exc:
        report = _evidence({
            "decision": "DENY", "reason_codes": ["AUTHORITY_PROVIDER_UNAVAILABLE"],
            "contract_id": contract.get("contract_id") if isinstance(contract, dict) else None,
            "intent_id": intent.get("intent_id") if isinstance(intent, dict) else None,
            "execution_state": "NOT_DISPATCHED", "result": None, "error_type": type(exc).__name__,
        })
        store.record_evidence(report)
        return report

    decision = evaluate_intent(intent, authority, contract, now=now)
    if decision.get("decision") != "ALLOW":
        report = _evidence({**decision, "execution_state": "NOT_DISPATCHED", "result": None})
        store.record_evidence(report)
        return report

    action = actions.get((str(intent["action_type"]), str(intent["target"])))
    if action is None:
        report = _evidence({
            **decision, "decision": "DENY", "reason_codes": ["ACTION_ADAPTER_NOT_REGISTERED"],
            "execution_state": "NOT_DISPATCHED", "result": None,
        })
        store.record_evidence(report)
        return report

    fingerprint = str(decision["intent_fingerprint"])
    key = str(intent["idempotency_key"])
    try:
        status, prior = store.reserve(key, fingerprint)
    except Exception as exc:
        report = _evidence({
            **decision, "decision": "DENY", "reason_codes": ["IDEMPOTENCY_STORE_UNAVAILABLE"],
            "execution_state": "NOT_DISPATCHED", "result": None, "error_type": type(exc).__name__,
        })
        store.record_evidence(report)
        return report

    if status == "REPLAY" and isinstance(prior, dict):
        return {**prior, "replayed": True}
    if status != "NEW":
        report = _evidence({
            **decision, "decision": "DENY", "reason_codes": ["IDEMPOTENCY_" + str(status)],
            "execution_state": "NOT_DISPATCHED", "result": None,
        })
        store.record_evidence(report)
        return report

    try:
        result = action(intent["payload"])
    except Exception as exc:
        # An adapter exception may occur after an external effect. Do not assert no effect.
        report = _evidence({
            **decision, "decision": "DENY", "reason_codes": ["ACTION_OUTCOME_REQUIRES_VERIFICATION"],
            "execution_state": "UNKNOWN", "result": None, "error_type": type(exc).__name__,
        })
        store.record_evidence(report)
        return report

    report = _evidence({**decision, "execution_state": "TEST_ACTION_COMPLETED", "result": result})
    try:
        store.complete(key, fingerprint, report, report)
    except Exception as exc:
        # The action returned, but its durable receipt did not. Reconciliation is mandatory.
        unknown = _evidence({
            **decision, "decision": "DENY", "reason_codes": ["RESULT_PERSISTENCE_UNCONFIRMED"],
            "execution_state": "UNKNOWN", "result": None, "error_type": type(exc).__name__,
        })
        store.record_evidence(unknown)
        return unknown
    return report
