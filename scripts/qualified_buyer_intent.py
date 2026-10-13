"""Evidence-gated qualification for 777 demand signals.

This module deliberately does not infer purchase intent from topic keywords.
It is a bounded classifier for source-backed evidence, not a revenue ledger.
"""
from __future__ import annotations

from datetime import datetime
from email.utils import parsedate_to_datetime
from hashlib import sha256
from urllib.parse import urlsplit


def _has_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _valid_source_url(value: object) -> bool:
    if not _has_text(value):
        return False
    parsed = urlsplit(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _valid_timestamp(value: object) -> bool:
    if not _has_text(value):
        return False
    text = value.strip()
    try:
        parsedate_to_datetime(text)
        return True
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
        return True
    except (TypeError, ValueError, OverflowError):
        return False


def classify_signal(signal: dict | None) -> dict:
    """Return UNKNOWN, DISCOVERY_ONLY, or QUALIFIED_BUYER_INTENT.

    Qualification requires explicit evidence fields. A topical headline alone
    can never qualify. Callers must populate these fields from source evidence,
    not from model-generated inference.
    """
    if not isinstance(signal, dict) or signal.get("source_fetch_failed") is True:
        return {"status": "UNKNOWN", "reason": "source_missing_or_failed"}

    if not _valid_source_url(signal.get("url")) or not _valid_timestamp(signal.get("published_at")):
        return {"status": "UNKNOWN", "reason": "source_url_or_timestamp_missing_or_invalid"}

    required = (
        signal.get("buyer_attribution"),
        signal.get("concrete_problem"),
        signal.get("explicit_solution_request"),
    )
    if all(_has_text(item) for item in required):
        return {
            "status": "QUALIFIED_BUYER_INTENT",
            "reason": "attributable_buyer_problem_and_explicit_request_with_provenance",
            "evidence_key": sha256(
                (signal["url"].strip().rstrip("/") + "|" + signal["published_at"].strip()).encode("utf-8")
            ).hexdigest(),
        }

    return {"status": "DISCOVERY_ONLY", "reason": "no_complete_explicit_buyer_intent_evidence"}


def deduplicate_signals(signals: list[dict]) -> list[dict]:
    """Keep the first signal per normalized source URL + timestamp."""
    seen: set[str] = set()
    result: list[dict] = []
    for signal in signals:
        verdict = classify_signal(signal)
        if verdict["status"] == "UNKNOWN":
            result.append({**signal, "qualification": verdict})
            continue
        key = verdict.get("evidence_key") or sha256(
            (signal["url"].strip().rstrip("/") + "|" + signal["published_at"].strip()).encode("utf-8")
        ).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        result.append({**signal, "qualification": verdict})
    return result


def empty_batch_receipt() -> dict:
    """An empty qualified batch is an internal no-op, never a public artifact."""
    return {
        "status": "NOOP_INTERNAL_ONLY",
        "qualified_intent_count": 0,
        "public_artifacts_created": 0,
        "reason": "no_admissible_qualified_buyer_intent",
    }
