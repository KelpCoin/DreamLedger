#!/usr/bin/env python3
from dataclasses import dataclass
from typing import Any

FUNNEL = ("OBSERVED", "QUALIFIABLE", "CAPABILITY_MATCHED", "TRAVERSABLE", "EXECUTABLE", "HUMAN_GATED", "REJECTED")

@dataclass(frozen=True)
class Result:
    opportunity_id: str | None
    state: str
    score: float
    reasons: tuple[str, ...]


def evaluate(record: dict[str, Any], registry: dict[str, Any]) -> Result:
    confidence = float(record.get("confidence") or 0)
    relevance = float(record.get("commercial_relevance") or 0)
    if confidence < 0.60 or relevance < 0.60 or not record.get("evidence"):
        return Result(record.get("opportunity_id"), "REJECTED", min(confidence, relevance), ("INSUFFICIENT_EVIDENCE",))
    known = {str(x.get("id")): x for x in registry.get("capabilities", []) if isinstance(x, dict)}
    required = [str(x) for x in (record.get("required_capabilities") or [])]
    if any(x not in known for x in required):
        return Result(record.get("opportunity_id"), "QUALIFIABLE", (confidence + relevance) / 2, ("CAPABILITY_MISSING",))
    if str(record.get("authority_lane") or "").upper() not in {"GREEN", "PUBLIC"}:
        return Result(record.get("opportunity_id"), "CAPABILITY_MATCHED", (confidence + relevance) / 2, ("AUTHORITY_NOT_CONFIRMED",))
    if any(str(known[x].get("automation", "")).upper() != "FULL" for x in required):
        return Result(record.get("opportunity_id"), "HUMAN_GATED", (confidence + relevance) / 2, ("HUMAN_GATE_REQUIRED",))
    if record.get("external_action_allowed") is not True:
        return Result(record.get("opportunity_id"), "TRAVERSABLE", (confidence + relevance) / 2, ("AUTHORIZATION_NOT_EXPLICIT",))
    return Result(record.get("opportunity_id"), "EXECUTABLE", (confidence + relevance) / 2, ("EXECUTABLE_PATH_CONFIRMED",))
