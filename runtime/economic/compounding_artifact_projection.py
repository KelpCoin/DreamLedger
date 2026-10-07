"""Compounding artifact projection for the existing 777 economic lifecycle.

This module does NOT create a second truth ledger, queue, or orchestrator.
It creates a durable, append-only projection of an already-existing economic
observation/outcome so later 777 cells can reuse verified experience.

Truth remains owned by the existing economic observation / outcome machinery.
Artifacts never promote UNVERIFIED facts into VERIFIED state.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

ARTIFACT_ROOT = Path("runtime/economic/artifacts")
ARTIFACT_INDEX = ARTIFACT_ROOT / "index.jsonl"


def _canonical(value: Mapping[str, Any]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def project_artifact(
    *,
    artifact_id: str,
    object_id: str,
    artifact_type: str,
    truth_state: str,
    observations: list[str],
    source_ids: list[str],
    capabilities: list[str] | None = None,
    evidence_requirements: list[str] | None = None,
    outcome: Mapping[str, Any] | None = None,
    reusable_for: list[str] | None = None,
) -> dict[str, Any]:
    """Create one durable projection from existing substrate.

    Required rule: the caller supplies the truth state already established by
    the existing economic truth machinery. This function cannot upgrade it.
    """

    if not artifact_id or not object_id:
        raise ValueError("artifact_id and object_id are required")
    if not observations:
        raise ValueError("at least one source-bound observation is required")

    previous_hash = ""
    if ARTIFACT_INDEX.exists():
        lines = ARTIFACT_INDEX.read_text(encoding="utf-8").splitlines()
        if lines:
            previous_hash = json.loads(lines[-1]).get("artifact_hash", "")

    artifact = {
        "artifact_id": artifact_id,
        "object_id": object_id,
        "artifact_type": artifact_type,
        "truth_state": truth_state,
        "observations": observations,
        "source_ids": source_ids,
        "capabilities": capabilities or [],
        "evidence_requirements": evidence_requirements or [],
        "outcome": dict(outcome or {}),
        "reusable_for": reusable_for or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "previous_artifact_hash": previous_hash,
    }

    artifact["artifact_hash"] = hashlib.sha256(
        _canonical(artifact).encode("utf-8")
    ).hexdigest()

    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    with ARTIFACT_INDEX.open("a", encoding="utf-8") as handle:
        handle.write(_canonical(artifact) + "\n")
        handle.flush()

    return artifact


def verify_chain() -> tuple[bool, str]:
    """Verify projection integrity without changing economic truth."""
    if not ARTIFACT_INDEX.exists():
        return True, "EMPTY"

    previous = ""
    for line_number, line in enumerate(
        ARTIFACT_INDEX.read_text(encoding="utf-8").splitlines(), start=1
    ):
        item = json.loads(line)
        recorded = item.pop("artifact_hash", None)
        if item.get("previous_artifact_hash", "") != previous:
            return False, f"PREVIOUS_HASH_MISMATCH:{line_number}"
        expected = hashlib.sha256(_canonical(item).encode("utf-8")).hexdigest()
        if recorded != expected:
            return False, f"ARTIFACT_HASH_MISMATCH:{line_number}"
        previous = recorded

    return True, "VERIFIED"
