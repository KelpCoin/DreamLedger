from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timezone
from typing import Optional


class HealthStatus(str, Enum):
    UNKNOWN = "UNKNOWN"
    REACHABLE = "REACHABLE"
    HEALTHY = "HEALTHY"
    CAPABLE = "CAPABLE"
    FULFILLABLE = "FULFILLABLE"
    STALE = "STALE"
    FAILED = "FAILED"


@dataclass(frozen=True)
class ProviderObservation:
    name: str
    reachable: bool
    healthy: bool
    capable: bool
    fulfillable: bool
    detail: str = ""


def freshness(last_health_check_at: Optional[str], ttl_seconds: int, now: Optional[datetime] = None) -> tuple[bool, str]:
    if ttl_seconds < 0:
        raise ValueError("health_ttl_seconds must be non-negative")
    if not last_health_check_at:
        return False, "NO_HEALTH_TIMESTAMP"
    try:
        stamp = datetime.fromisoformat(last_health_check_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("INVALID_HEALTH_TIMESTAMP") from exc
    now = now or datetime.now(timezone.utc)
    age = (now - stamp).total_seconds()
    if age < 0:
        return False, "HEALTH_TIMESTAMP_IN_FUTURE"
    if age > ttl_seconds:
        return False, "HEALTH_STALE"
    return True, "HEALTH_FRESH"


def aggregate(observations: list[ProviderObservation], fresh: bool) -> HealthStatus:
    if not fresh:
        return HealthStatus.STALE
    if not all(x.reachable for x in observations):
        return HealthStatus.FAILED
    if not all(x.healthy for x in observations):
        return HealthStatus.HEALTHY
    if not all(x.capable for x in observations):
        return HealthStatus.CAPABLE
    if not all(x.fulfillable for x in observations):
        return HealthStatus.CAPABLE
    return HealthStatus.FULFILLABLE


def evaluate(
    observations: list[ProviderObservation],
    last_health_check_at: Optional[str],
    ttl_seconds: int,
    now: Optional[datetime] = None,
) -> dict:
    fresh, reason = freshness(last_health_check_at, ttl_seconds, now)
    overall = aggregate(observations, fresh)
    return {
        "overall": overall.value,
        "fresh": fresh,
        "stale_reason": None if fresh else reason,
        "providers": [
            {
                "name": x.name,
                "reachable": x.reachable,
                "healthy": x.healthy,
                "capable": x.capable,
                "fulfillable": x.fulfillable,
                "detail": x.detail,
            }
            for x in observations
        ],
        "truth_status": "INTERNAL",
        "economic_effect": 0,
    }


if __name__ == "__main__":
    print("INTERNAL/TEST reference health module. No network calls are performed.")
