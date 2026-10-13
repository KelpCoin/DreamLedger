"""Evidence-gated qualification for public 777 demand signals.

This module extracts only literal source evidence. It does not infer purchase intent
from topic keywords and does not write to a revenue ledger.
"""
from __future__ import annotations

from datetime import datetime
from email.utils import parsedate_to_datetime
from hashlib import sha256
from urllib.parse import urlsplit
import html
import re


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
    """Return UNKNOWN, DISCOVERY_ONLY, or QUALIFIED_BUYER_INTENT."""
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
            "reason": "attributable_public_author_problem_and_explicit_request_with_provenance",
            "evidence_key": sha256(
                (signal["url"].strip().rstrip("/") + "|" + signal["published_at"].strip()).encode("utf-8")
            ).hexdigest(),
        }

    return {"status": "DISCOVERY_ONLY", "reason": "no_complete_explicit_buyer_intent_evidence"}


_REQUEST_RE = re.compile(
    r"\b(?:looking for|searching for|can anyone recommend|can somebody recommend|"
    r"anyone recommend|any recommendations?(?: for)?|does anyone know(?: of)?|"
    r"anyone know(?: of)?|is there (?:a|an|any)|how can (?:i|we)|"
    r"can someone (?:build|recommend|help)|looking to hire|hire someone to|"
    r"pay someone to|need (?:a|an|some|help with|a way to|a tool|software|service|"
    r"someone|an api)|want (?:a|an|someone|to)|recommend (?:a|an|some)|"
    r"what (?:tool|service|api|software)|alternative to)\b",
    re.IGNORECASE,
)
_PAIN_RE = re.compile(
    r"\b(?:invoice|invoices|receipt|receipts|quote|quotes|pricing|payment|payments|"
    r"webhook|api|pdf|ocr|document|documents|csv|data extraction|reconciliation|"
    r"shipping|returns|integration|automation|workflow|bookkeeping|billing)\b",
    re.IGNORECASE,
)
_PROBLEM_RE = re.compile(
    r"\b(?:manual|manually|broken|fails?|failing|error|errors|cannot|can't|"
    r"doesn't|does not|won't|not working|struggling|struggle|problem|issue|"
    r"takes too long|slow|expensive|missing|reconcile|reconciling|spend|"
    r"waste|pain|hard to|difficult to|need to)\b",
    re.IGNORECASE,
)


def _plain_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    value = html.unescape(re.sub(r"<[^>]*>", " ", value))
    return re.sub(r"\s+", " ", value).strip()


def derive_explicit_request_fields(signal: dict | None) -> dict:
    """Extract source-literal author/problem/request evidence; never infer it."""
    if not isinstance(signal, dict):
        return {"buyer_attribution": "", "concrete_problem": "", "explicit_solution_request": ""}
    author = _plain_text(signal.get("author"))
    title = _plain_text(signal.get("title"))
    body = _plain_text(signal.get("text") or signal.get("comment_text") or signal.get("story_text"))
    combined = ". ".join(part for part in (title, body) if part)
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", combined) if part.strip()]
    request_sentence = next((s for s in sentences if _REQUEST_RE.search(s)), "")
    problem_sentence = next(
        (s for s in sentences if _PAIN_RE.search(s) and _PROBLEM_RE.search(s) and len(s) >= 18),
        "",
    )
    return {
        "buyer_attribution": f"Public source author: {author}" if author else "",
        "concrete_problem": problem_sentence,
        "explicit_solution_request": request_sentence,
    }


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
