#!/usr/bin/env python3
"""Deterministic, air-gapped job-to-capability admission gate.
No network access. No model calls. No external mutations.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Any

def load_registry(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))

def capability_index(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(item["id"]): item for item in registry.get("capabilities", [])}

def evaluate_job(job: dict[str, Any], registry: dict[str, Any]) -> dict[str, Any]:
    index = capability_index(registry)
    required = list(job.get("required_capabilities") or [])
    missing = [cap for cap in required if cap not in index]
    blockers = []
    external_gates = []
    matched = []

    for cap_id in required:
        cap = index.get(cap_id)
        if not cap:
            continue
        matched.append({"id": cap_id, "automation": cap.get("automation", "UNKNOWN")})
        external_gates.extend(cap.get("external_gates") or [])
        if cap.get("automation") != "FULL":
            blockers.append("CAPABILITY_PARTIAL:" + cap_id)

    blockers.extend("MISSING_CAPABILITY:" + cap for cap in missing)

    if missing:
        verdict, automation = "CANNOT_FULFILL", "NONE"
    elif blockers:
        verdict, automation = "CAN_PARTIALLY_FULFILL", "HUMAN_REQUIRED"
    else:
        verdict, automation = "CAN_FULFILL", "FULL"

    return {
        "schema": "dreamledger/job-fulfillment-gate/v1",
        "job_id": job.get("job_id"),
        "verdict": verdict,
        "automation_level": automation,
        "matched_capabilities": matched,
        "blockers": blockers,
        "external_gates": sorted(set(external_gates)),
        "acceptance_rule": "Only CAN_FULFILL jobs may enter a fully automated execution queue."
    }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("job_json")
    parser.add_argument("--registry", default=str(Path(__file__).with_name("capability_registry.json")))
    args = parser.parse_args()
    job = json.loads(Path(args.job_json).read_text(encoding="utf-8"))
    print(json.dumps(evaluate_job(job, load_registry(args.registry)), indent=2, sort_keys=True))
