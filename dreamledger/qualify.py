"""Nine-point buyer qualification. Unknown evidence fails closed."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

PRICE_HINTS = re.compile(r"(?:NZ\$|USD?\s?\$|US\$|\$)\s?(\d{2,5})", re.I)
PAID_INTENT = re.compile(r"\b(paid|pay|budget|budgeting|invoice|hire|hiring|contract|fixed[- ]price|rate|quote|proposal|compensat)\w*", re.I)
PROVIDER_MARKER = re.compile(r"\[For Hire\]|\bavailable for\b|\bI(?:'m| am) available\b|\bmy (?:rate|rates|price|prices)\b|\bDM me\b|\breach out to me\b", re.I)
SCOPE_IMPLEMENTATION = re.compile(r"\b(build|implement|complete|finish|set up|connect|wire|automate|migrate|integrate|deploy)\b", re.I)
SCOPE_DIAGNOSTIC = re.compile(r"\b(fix|repair|debug|diagnose|broken|failing|not working|error|bug|issue with|stopped working)\b", re.I)
FRESHNESS_DAYS = 14


def _first_match(text: str, pattern: re.Pattern[str]) -> str:
    m = pattern.search(text)
    return m.group(0) if m else ""


def evaluate(*, thread_text: str, thread_url: str, buyer_handle: str, last_buyer_activity: str | None, thread_kind: str) -> dict[str, Any]:
    text = thread_text or ""
    points: dict[str, dict[str, Any]] = {}

    points["1_retrievable_url"] = {"ok": bool(thread_url and thread_url.startswith("http")), "evidence": thread_url or ""}
    points["2_specific_buyer"] = {"ok": bool(buyer_handle and buyer_handle.lower() not in ("", "unknown")), "evidence": buyer_handle or ""}

    has_problem = bool(SCOPE_DIAGNOSTIC.search(text) or SCOPE_IMPLEMENTATION.search(text))
    points["3_specific_problem"] = {"ok": has_problem, "evidence": _first_match(text, SCOPE_DIAGNOSTIC) or _first_match(text, SCOPE_IMPLEMENTATION)}

    paid = PAID_INTENT.search(text)
    points["4_paid_intent"] = {"ok": bool(paid), "evidence": paid.group(0) if paid else ""}

    served = re.search(r"\b(selected|solved|completed|got it working|all good now|found someone|hired)\b", text, re.I)
    points["5_not_served"] = {"ok": not bool(served), "evidence": served.group(0) if served else "no selection language found"}

    if SCOPE_DIAGNOSTIC.search(text) and not SCOPE_IMPLEMENTATION.search(text):
        scope_kind = "rescue"
    elif SCOPE_IMPLEMENTATION.search(text):
        scope_kind = "implementation"
    else:
        scope_kind = "unknown"
    points["6_scope_fit"] = {
        "ok": scope_kind in ("rescue", "implementation"),
        "evidence": scope_kind,
        "recommended_sku": {"rescue": "N8N-RESCUE-001", "implementation": "N8N-IMPLEMENT-001"}.get(scope_kind),
    }

    if last_buyer_activity:
        try:
            d = datetime.fromisoformat(last_buyer_activity).date()
            age = (date.today() - d).days
            points["7_freshness"] = {"ok": 0 <= age <= FRESHNESS_DAYS, "evidence": f"{age} days old (limit {FRESHNESS_DAYS})", "age_days": age}
        except (TypeError, ValueError) as exc:
            points["7_freshness"] = {"ok": False, "evidence": f"unparseable date: {exc}"}
    else:
        points["7_freshness"] = {"ok": False, "evidence": "no buyer-originated date supplied"}

    reachable = bool(thread_url and (thread_url.startswith("http://") or thread_url.startswith("https://")))
    points["8_reachable_channel"] = {"ok": reachable, "evidence": thread_url}

    prices = PRICE_HINTS.findall(text)
    price = int(prices[0]) if prices else None
    points["9_deliverable"] = {
        "ok": scope_kind != "unknown",
        "evidence": f"{scope_kind}: fix or build one bounded workflow" + (f" for NZ${price}" if price else ""),
        "price_detected": price,
    }

    if thread_kind == "for_hire" or PROVIDER_MARKER.search(text):
        return {"verdict": "FAIL", "reason": "provider_post_detected", "points": points, "recommended_action": "discard"}

    failed = [k for k, v in points.items() if not v["ok"]]
    return {
        "verdict": "PASS" if not failed else "FAIL",
        "points_passed": len(points) - len(failed),
        "points_failed": failed,
        "points": points,
        "recommended_action": "draft_outreach" if not failed else f"discard — first failure: {failed[0]}",
    }
