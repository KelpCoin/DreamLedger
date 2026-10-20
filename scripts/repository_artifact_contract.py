from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

SCHEMA = "dreamledger.777.repository-expedition.v1"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_SHA1 = re.compile(r"^[0-9a-f]{40}$")
_REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
_REUSE = {"REFERENCE_ONLY", "DEPENDENCY_CANDIDATE", "CODE_IMPORT_CANDIDATE", "REJECTED"}
_LICENSE = {"VERIFIED_PERMISSIVE", "VERIFIED_OTHER", "NOASSERTION", "UNKNOWN"}
_TRUE_FORBIDDEN = (
    "private_data_transferred",
    "credentials_transferred",
    "code_executed",
    "dependency_installed",
    "production_changed",
    "external_action_sent",
    "economic_revenue_claim",
)


def _aware_iso(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.tzinfo is not None and parsed.utcoffset() is not None
    except (ValueError, TypeError):
        return False


def canonical_packet_sha256(packet: dict[str, Any]) -> str:
    payload = dict(packet)
    payload.pop("packet_sha256", None)
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_packet(packet: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(packet, dict):
        return ["packet must be a JSON object"]
    if packet.get("schema") != SCHEMA:
        errors.append("schema must equal " + SCHEMA)
    if not isinstance(packet.get("expedition_id"), str) or not packet["expedition_id"].strip():
        errors.append("expedition_id is required")
    if not _aware_iso(packet.get("observed_at")):
        errors.append("observed_at must be an ISO timestamp with timezone")
    if packet.get("truth_status") != "UNVERIFIED":
        errors.append("truth_status must remain UNVERIFIED")

    worker = packet.get("worker")
    if not isinstance(worker, dict) or not all(isinstance(worker.get(k), str) and worker[k].strip() for k in ("worker_id", "runtime")):
        errors.append("worker.worker_id and worker.runtime are required")
    elif worker.get("runtime") not in {"LOCAL_GPU", "CLOUD_GPU", "CPU", "LLM_COUNCIL"}:
        errors.append("worker.runtime must identify an allowed runtime class")

    membrane = packet.get("membrane")
    if not isinstance(membrane, dict):
        errors.append("membrane object is required")
    else:
        if membrane.get("direction") != "OFFLINE_TO_ONLINE_AND_RETURN":
            errors.append("membrane.direction must be OFFLINE_TO_ONLINE_AND_RETURN")
        if membrane.get("status") != "ONLINE_VALIDATED":
            errors.append("only ONLINE_VALIDATED packets may count as compounding artifacts")
        if not _aware_iso(membrane.get("validated_at")):
            errors.append("membrane.validated_at must be timezone-aware")
        if membrane.get("public_metadata_verified") is not True:
            errors.append("public metadata must be independently verified online")

    source = packet.get("source")
    if not isinstance(source, dict):
        errors.append("source object is required")
        source = {}
    repo = source.get("repository_full_name")
    if not isinstance(repo, str) or not _REPO.fullmatch(repo):
        errors.append("source.repository_full_name must be owner/repository")
    else:
        expected_url = "https://github.com/" + repo
        if source.get("repository_url") != expected_url:
            errors.append("source.repository_url must match the canonical public GitHub repo URL")
        owner = repo.split("/", 1)[0]
        api_url = source.get("metadata_evidence_url")
        if not isinstance(api_url, str) or not api_url.startswith("https://api.github.com/repos/" + repo):
            errors.append("source.metadata_evidence_url must cite GitHub public repository metadata")
        license_url = source.get("license_evidence_url")
        valid_license_url = isinstance(license_url, str) and (
            license_url.startswith("https://api.github.com/repos/" + repo + "/license")
            or license_url.startswith("https://github.com/" + repo + "/blob/")
            or license_url.startswith("https://raw.githubusercontent.com/" + repo + "/")
        )
        if not valid_license_url:
            errors.append("source.license_evidence_url must cite repository licence evidence")
        if source.get("owner") != owner:
            errors.append("source.owner must match repository_full_name")
    if source.get("visibility") != "public":
        errors.append("only publicly discoverable repositories are admissible")
    if not isinstance(source.get("default_branch"), str) or not source["default_branch"].strip():
        errors.append("source.default_branch is required")
    if not isinstance(source.get("head_sha"), str) or not _SHA1.fullmatch(source["head_sha"]):
        errors.append("source.head_sha must be a 40-character commit SHA")
    if not _aware_iso(source.get("checked_at")):
        errors.append("source.checked_at must be timezone-aware")
    if source.get("license_status") not in _LICENSE:
        errors.append("source.license_status must explicitly represent licence evidence or uncertainty")
    if source.get("license_status") in {"UNKNOWN", "NOASSERTION", "VERIFIED_OTHER"} and packet.get("assessment", {}).get("reuse_recommendation") == "CODE_IMPORT_CANDIDATE":
        errors.append("code import requires a reviewed, compatible permissive licence")

    assessment = packet.get("assessment")
    assessment_fields = (
        "capability_gap", "why_relevant", "existing_stack_check", "reuse_recommendation",
        "maintenance_status", "security_status", "compatibility_status", "operational_cost",
        "expected_benefit", "next_gate",
    )
    if not isinstance(assessment, dict):
        errors.append("assessment object is required")
        assessment = {}
    for key in assessment_fields:
        if not isinstance(assessment.get(key), str) or not assessment[key].strip():
            errors.append("assessment." + key + " is required")
    if assessment.get("reuse_recommendation") not in _REUSE:
        errors.append("assessment.reuse_recommendation has an invalid value")

    controls = packet.get("controls")
    if not isinstance(controls, dict):
        errors.append("controls object is required")
    else:
        for key in _TRUE_FORBIDDEN:
            if controls.get(key) is not False:
                errors.append("controls." + key + " must be false")
    digest = packet.get("packet_sha256")
    if not isinstance(digest, str) or not _SHA256.fullmatch(digest):
        errors.append("packet_sha256 must be a 64-character SHA-256 digest")
    elif digest != canonical_packet_sha256(packet):
        errors.append("packet_sha256 does not match canonical packet contents")
    return errors


def validate_file(path: str | Path) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return None, [f"cannot read JSON artifact: {exc}"]
    errors = validate_packet(payload)
    return (payload if not errors else None), errors
