"""Fail-closed BECK policy evaluator. It does not execute external effects."""
from __future__ import annotations
from datetime import datetime, timezone
import json

CONTRACT_ID = "dreamledger.beck.bounded-execution.v1"
REQUIRED = {"intent_id", "action_type", "target", "issued_at", "idempotency_key", "payload", "limits"}

def _time(value):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone required")
    return parsed.astimezone(timezone.utc)

def _deny(code, now, intent=None, authority=None):
    intent = intent if isinstance(intent, dict) else {}
    authority = authority if isinstance(authority, dict) else {}
    return {"decision": "DENY", "reason_codes": [code], "contract_id": CONTRACT_ID,
            "evaluated_at": now.isoformat().replace("+00:00", "Z"),
            "intent_id": intent.get("intent_id"), "authority_reference": authority.get("reference"),
            "idempotency_key": intent.get("idempotency_key")}

def evaluate_intent(intent, authority, contract, now=None, prior_idempotency=None):
    """Evaluate policy only. Caller must authenticate authority and persist idempotency atomically."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    if not isinstance(contract, dict) or contract.get("contract_id") != CONTRACT_ID or contract.get("status") != "ACTIVE":
        return _deny("INVALID_CONTRACT", now, intent, authority)
    if not isinstance(intent, dict) or not REQUIRED.issubset(intent):
        return _deny("INVALID_INTENT", now, intent, authority)
    try:
        if _time(intent["issued_at"]) > now:
            return _deny("INTENT_FROM_FUTURE", now, intent, authority)
    except (ValueError, TypeError, OverflowError):
        return _deny("INVALID_INTENT_TIMESTAMP", now, intent, authority)
    action = intent.get("action_type")
    if action not in contract.get("allowed_action_types", []):
        return _deny("ACTION_NOT_ALLOWLISTED", now, intent, authority)
    if intent.get("target") not in contract.get("allowed_targets", {}).get(action, []):
        return _deny("TARGET_OUT_OF_SCOPE", now, intent, authority)
    if not isinstance(intent.get("payload"), dict) or not isinstance(intent.get("limits"), dict):
        return _deny("INVALID_PAYLOAD_OR_LIMITS", now, intent, authority)
    try:
        payload_bytes = len(json.dumps(intent["payload"], separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError):
        return _deny("INVALID_PAYLOAD", now, intent, authority)
    ceilings = contract.get("limits", {})
    if payload_bytes > ceilings.get("max_payload_bytes", 0):
        return _deny("RESOURCE_LIMIT_EXCEEDED", now, intent, authority)
    for name in ("max_attempts", "max_duration_seconds", "max_api_calls", "max_spend_minor_units"):
        value = intent["limits"].get(name)
        ceiling = ceilings.get(name, -1)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > ceiling:
            return _deny("RESOURCE_LIMIT_EXCEEDED", now, intent, authority)
    if not isinstance(authority, dict):
        return _deny("AUTHORITY_MISSING", now, intent)
    try:
        expiry = _time(authority["expires_at"])
    except (KeyError, ValueError, TypeError, OverflowError):
        return _deny("AUTHORITY_INVALID_OR_EXPIRED", now, intent, authority)
    if authority.get("state") != "APPROVED":
        return _deny("AUTHORITY_NOT_APPROVED", now, intent, authority)
    if expiry <= now:
        return _deny("AUTHORITY_EXPIRED", now, intent, authority)
    if any(authority.get(k) != intent.get(k) for k in ("intent_id", "action_type", "target")):
        return _deny("AUTHORITY_SCOPE_MISMATCH", now, intent, authority)
    if not authority.get("reference"):
        return _deny("AUTHORITY_REFERENCE_MISSING", now, intent, authority)
    fingerprint = json.dumps(intent, sort_keys=True, separators=(",", ":"), default=str)
    prior = (prior_idempotency or {}).get(str(intent["idempotency_key"]))
    if prior is not None and prior != fingerprint:
        return _deny("IDEMPOTENCY_CONFLICT", now, intent, authority)
    return {"decision": "ALLOW", "reason_codes": ["POLICY_CHECKS_PASSED"], "contract_id": CONTRACT_ID,
            "evaluated_at": now.isoformat().replace("+00:00", "Z"), "intent_id": intent["intent_id"],
            "authority_reference": authority["reference"], "idempotency_key": intent["idempotency_key"],
            "intent_fingerprint": fingerprint}
