from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

try:
    from repository_artifact_contract import SCHEMA, canonical_packet_sha256, validate_packet
except ModuleNotFoundError:
    # The CLI is run from scripts/, while unit tests may load this file by path.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from repository_artifact_contract import SCHEMA, canonical_packet_sha256, validate_packet

LEAD_SCHEMA = "dreamledger.777.repository-lead.v1"
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$")
PERMISSIVE = {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "CC0-1.0"}


def aware_iso(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.tzinfo is not None and parsed.utcoffset() is not None
    except (ValueError, TypeError):
        return False


def validate_lead(lead: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(lead, dict):
        return ["lead must be a JSON object"]
    if lead.get("schema") != LEAD_SCHEMA:
        errors.append("schema must equal " + LEAD_SCHEMA)
    expedition_id = lead.get("expedition_id")
    if not isinstance(expedition_id, str) or not ID_RE.fullmatch(expedition_id):
        errors.append("expedition_id must be a safe filename token")
    if not aware_iso(lead.get("found_at")):
        errors.append("found_at must be a timezone-aware ISO timestamp")
    worker = lead.get("worker")
    if not isinstance(worker, dict) or not all(isinstance(worker.get(k), str) and worker[k].strip() for k in ("worker_id", "runtime")):
        errors.append("worker identity and runtime are required")
    elif worker.get("runtime") not in {"LOCAL_GPU", "CLOUD_GPU", "CPU", "LLM_COUNCIL"}:
        errors.append("worker.runtime is unsupported")
    source = lead.get("source")
    if not isinstance(source, dict):
        errors.append("source object is required")
        source = {}
    repo = source.get("repository_full_name")
    if not isinstance(repo, str) or not REPO_RE.fullmatch(repo):
        errors.append("source.repository_full_name must be owner/repository")
    elif source.get("repository_url") != "https://github.com/" + repo:
        errors.append("source.repository_url must be the canonical GitHub repo URL")
    assessment = lead.get("assessment")
    if not isinstance(assessment, dict):
        errors.append("assessment object is required")
        assessment = {}
    for key in ("capability_gap", "why_relevant", "existing_stack_check", "reuse_recommendation"):
        if not isinstance(assessment.get(key), str) or not assessment[key].strip():
            errors.append("assessment." + key + " is required")
    if assessment.get("reuse_recommendation") not in {"REFERENCE_ONLY", "DEPENDENCY_CANDIDATE", "CODE_IMPORT_CANDIDATE", "REJECTED"}:
        errors.append("assessment.reuse_recommendation is invalid")
    controls = lead.get("controls")
    if not isinstance(controls, dict):
        errors.append("controls object is required")
    else:
        for key in ("private_data_transferred", "credentials_transferred", "code_executed", "dependency_installed", "production_changed", "external_action_sent", "economic_revenue_claim"):
            if controls.get(key) is not False:
                errors.append("controls." + key + " must be false")
    digest = lead.get("packet_sha256")
    if not isinstance(digest, str) or digest != canonical_packet_sha256(lead):
        errors.append("packet_sha256 is missing or does not match canonical lead contents")
    return errors


def github_json(url: str, token: str = "") -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "DreamLedger-777-Repository-Membrane/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("GitHub API returned a non-object response")
            return data
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return {"_not_found": True}
        # Never include request headers or environment variables in surfaced errors.
        raise RuntimeError("GitHub public metadata request failed with HTTP " + str(exc.code)) from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("GitHub public metadata request failed: " + type(exc).__name__) from None


def hydrate_lead(lead: dict[str, Any], fetch_json: Callable[[str], dict[str, Any]], now: str | None = None) -> dict[str, Any]:
    errors = validate_lead(lead)
    if errors:
        raise ValueError("; ".join(errors))
    repo = lead["source"]["repository_full_name"]
    base = "https://api.github.com/repos/" + repo
    metadata = fetch_json(base)
    if metadata.get("_not_found") or metadata.get("private") is True or not (metadata.get("private") is False or metadata.get("visibility") == "public"):
        raise ValueError("repository is not confirmed publicly accessible")
    default_branch = metadata.get("default_branch")
    if not isinstance(default_branch, str) or not default_branch.strip():
        raise ValueError("public repository metadata did not expose a default branch")
    commit = fetch_json(base + "/commits/" + default_branch)
    head_sha = str(commit.get("sha") or "")
    if not re.fullmatch(r"[0-9a-f]{40}", head_sha):
        raise ValueError("current default-branch commit SHA was not verified")
    license_url = base + "/license"
    license_result = fetch_json(license_url)
    license_obj = license_result.get("license") if not license_result.get("_not_found") else None
    spdx = str((license_obj or {}).get("spdx_id") or "NOASSERTION")
    if license_result.get("_not_found"):
        license_status = "UNKNOWN"
        spdx = "UNKNOWN"
    elif spdx in PERMISSIVE:
        license_status = "VERIFIED_PERMISSIVE"
    elif spdx == "NOASSERTION":
        license_status = "NOASSERTION"
    else:
        license_status = "VERIFIED_OTHER"

    observed = now or datetime.now(timezone.utc).isoformat()
    original_assessment = lead["assessment"]
    recommendation = original_assessment["reuse_recommendation"]
    next_gate = original_assessment.get("next_gate") or "Review current compatibility, security, licence and operational cost."
    if recommendation in {"CODE_IMPORT_CANDIDATE", "DEPENDENCY_CANDIDATE"} and license_status != "VERIFIED_PERMISSIVE":
        recommendation = "REFERENCE_ONLY"
        next_gate = "Licence is not confirmed as permissive; reference-only until a human verifies licence, security and compatibility."
    assessment = {
        "capability_gap": original_assessment["capability_gap"],
        "why_relevant": original_assessment["why_relevant"],
        "existing_stack_check": original_assessment["existing_stack_check"],
        "reuse_recommendation": recommendation,
        "maintenance_status": original_assessment.get("maintenance_status") or "NOT_ASSESSED; verify releases and maintainer activity",
        "security_status": original_assessment.get("security_status") or "NOT_AUDITED; review advisories and dependency tree",
        "compatibility_status": original_assessment.get("compatibility_status") or "NOT_TESTED against current DreamLedger framework/runtime",
        "operational_cost": original_assessment.get("operational_cost") or "NOT_MEASURED; evaluate hosting, build and runtime cost before adoption",
        "expected_benefit": original_assessment.get("expected_benefit") or "Hypothesis only; measure before and after any approved integration",
        "next_gate": next_gate,
    }
    packet = {
        "schema": SCHEMA,
        "expedition_id": lead["expedition_id"],
        "observed_at": observed,
        "truth_status": "UNVERIFIED",
        "worker": lead["worker"],
        "membrane": {
            "direction": "OFFLINE_TO_ONLINE_AND_RETURN",
            "status": "ONLINE_VALIDATED",
            "validated_at": observed,
            "public_metadata_verified": True,
        },
        "source": {
            "repository_full_name": repo,
            "repository_url": "https://github.com/" + repo,
            "owner": repo.split("/", 1)[0],
            "visibility": "public",
            "default_branch": default_branch,
            "head_sha": head_sha,
            "checked_at": observed,
            "metadata_evidence_url": base,
            "license_evidence_url": license_url,
            "license_status": license_status,
            "license_spdx_id": spdx,
        },
        "assessment": assessment,
        "controls": {
            "private_data_transferred": False,
            "credentials_transferred": False,
            "code_executed": False,
            "dependency_installed": False,
            "production_changed": False,
            "external_action_sent": False,
            "economic_revenue_claim": False,
        },
    }
    packet["packet_sha256"] = canonical_packet_sha256(packet)
    packet_errors = validate_packet(packet)
    if packet_errors:
        raise ValueError("hydrated artifact failed contract: " + "; ".join(packet_errors))
    return packet


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate offline repository leads against public GitHub metadata without executing candidate code.")
    parser.add_argument("--input-dir", default="data/777/repository-handoffs")
    parser.add_argument("--output-dir", default="data/777/repository-expeditions")
    args = parser.parse_args()
    source_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    leads = sorted(source_dir.glob("*.json")) if source_dir.exists() else []
    if not leads:
        print("REPOSITORY_MEMBRANE=NO_LEADS")
        return 0
    output_dir.mkdir(parents=True, exist_ok=True)
    token = os.environ.get("GITHUB_TOKEN", "")
    failures = 0
    for path in leads:
        try:
            lead = json.loads(path.read_text(encoding="utf-8"))
            hydrated = hydrate_lead(lead, lambda url: github_json(url, token))
            target = output_dir / (lead["expedition_id"] + ".json")
            if target.exists():
                existing = json.loads(target.read_text(encoding="utf-8"))
                if existing.get("packet_sha256") == hydrated["packet_sha256"]:
                    print("REPOSITORY_MEMBRANE=SKIP_DUPLICATE:" + target.as_posix())
                    continue
                raise ValueError("expedition ID already exists with different content")
            target.write_text(json.dumps(hydrated, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            print("REPOSITORY_MEMBRANE=ONLINE_VALIDATED:" + target.as_posix())
        except Exception as exc:
            failures += 1
            print("REPOSITORY_MEMBRANE=QUARANTINED:" + path.name + ":" + str(exc), file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
