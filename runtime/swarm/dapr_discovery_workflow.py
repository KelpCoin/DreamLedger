"""DreamLedger discovery orchestration boundary.

The workflow owns discovery fan-out/fan-in and admission preparation.
DreamLedger remains authoritative for economic truth and external authority.

This module is intentionally safe to import without Dapr installed. The
runtime dependency is installed by the swarm orchestration environment.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DiscoveryBatch:
    batch_id: str
    source_ids: tuple[str, ...]
    max_observations_per_source: int = 1000


def build_discovery_plan(batch: DiscoveryBatch) -> dict[str, Any]:
    return {
        "batch_id": batch.batch_id,
        "fan_out": [
            {
                "source_id": source_id,
                "max_observations": batch.max_observations_per_source,
                "operation": "OBSERVE_ONLY",
            }
            for source_id in batch.source_ids
        ],
        "fan_in": {
            "operation": "NORMALIZE_DEDUPE_FRESHNESS_ADMISSION",
            "economic_truth_mutation": False,
            "external_action": False,
        },
    }


def admission_payload(observation: dict[str, Any]) -> dict[str, Any]:
    """Convert a discovered observation into the existing mass-admission shape."""
    return {
        "opportunity_id": observation.get("opportunity_id"),
        "confidence": observation.get("confidence", 0),
        "commercial_relevance": observation.get("commercial_relevance", 0),
        "evidence": observation.get("evidence", []),
        "required_capabilities": observation.get("required_capabilities", []),
        "authority_lane": observation.get("authority_lane", "UNKNOWN"),
        "external_action_allowed": observation.get("external_action_allowed", False),
    }
