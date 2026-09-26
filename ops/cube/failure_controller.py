"""Deterministic failure classification, bounded retry, and replay decisions.
No LLM calls. Dependency-light and fail-closed.
"""
from dataclasses import dataclass
from enum import Enum
import hashlib, random, re, time

class FailureClass(str, Enum):
    OPERATIONAL = "OPERATIONAL"
    ECONOMIC = "ECONOMIC"

class ErrorClass(str, Enum):
    TRANSIENT = "TRANSIENT"
    MALFORMED = "MALFORMED"
    POISON = "POISON"
    DEPENDENCY = "DEPENDENCY"
    ECONOMIC = "ECONOMIC"

class ReplayDecision(str, Enum):
    NEVER = "never"
    REPLAY_ONCE = "replay_once"
    HOLD = "hold"

@dataclass(frozen=True)
class Failure:
    code: str
    detail: str
    error_class: ErrorClass
    failure_class: FailureClass
    next_allowed_mutation: str

def normalized_error_signature(code: str, detail: str = "") -> str:
    text = f"{code} {detail}".upper()
    text = re.sub(r"\b[0-9a-f]{8,}\b", "<HEX>", text)
    text = re.sub(r"\b\d+(?:\.\d+)?\b", "<N>", text)
    text = re.sub(r"\s+", " ", text).strip()
    return hashlib.sha256(text.encode()).hexdigest()

def classify_failure(code: str, detail: str = "") -> Failure:
    c = code.upper()
    if any(x in c for x in ("TIMEOUT","429","RATE_LIMIT","CONNECTION_RESET","TEMPORARY")):
        return Failure(c, detail, ErrorClass.TRANSIENT, FailureClass.OPERATIONAL, "WAIT")
    if any(x in c for x in ("MALFORMED","INVALID_SCHEMA","NULL_TARGET","BAD_PACKET")):
        return Failure(c, detail, ErrorClass.MALFORMED, FailureClass.OPERATIONAL, "REPAIR_INPUT")
    if any(x in c for x in ("POISON","UNSUPPORTED","CONTRACT_VIOLATION")):
        return Failure(c, detail, ErrorClass.POISON, FailureClass.OPERATIONAL, "QUARANTINE")
    if any(x in c for x in ("DEPENDENCY","HTTP_5","DNS","AUTH","UNAVAILABLE")):
        return Failure(c, detail, ErrorClass.DEPENDENCY, FailureClass.OPERATIONAL, "PROBE_DEPENDENCY")
    return Failure(c, detail, ErrorClass.ECONOMIC, FailureClass.ECONOMIC, "MUTATE_HYPOTHESIS")

def backoff_seconds(attempt: int, base: float = 2.0, cap: float = 60.0) -> float:
    bounded = min(cap, base * (2 ** max(0, attempt - 1)))
    return round(random.uniform(0.5 * bounded, bounded), 3)

def replay_gate(*, attempt_count: int, already_committed: bool, failure_class: str, max_retries: int = 2) -> ReplayDecision:
    if already_committed:
        return ReplayDecision.NEVER
    if failure_class == FailureClass.ECONOMIC.value:
        return ReplayDecision.HOLD
    if attempt_count >= max_retries:
        return ReplayDecision.HOLD
    return ReplayDecision.REPLAY_ONCE

def should_open_breaker(failure_count: int, window_failures: int = 5) -> bool:
    return failure_count >= window_failures

def breaker_probe_allowed(state: str, next_probe_at: float | None, now: float | None = None) -> bool:
    if state == "CLOSED":
        return True
    if state == "OPEN":
        return next_probe_at is not None and (now or time.time()) >= next_probe_at
    return state == "HALF_OPEN"
