#!/usr/bin/env python3
"""Validate a round-trip artifact receipt and SHA-256 hashes.

This is a package-integrity check, not proof that the task is correct or that
any external action/payment occurred. Uses only the Python standard library.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
STATUSES = {"SUCCEEDED", "FAILED", "BLOCKED"}
CHECK_STATUSES = {"PASS", "FAIL", "NOT_RUN"}


def fail(message: str) -> None:
    raise ValueError(message)


def safe_output_path(root: Path, value: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        fail(f"output path must be relative: {value}")
    resolved_root = root.resolve()
    resolved = (root / candidate).resolve()
    if resolved != resolved_root and resolved_root not in resolved.parents:
        fail(f"output path escapes package root: {value}")
    return resolved


def validate(root: Path, receipt_path: Path) -> list[str]:
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    if not isinstance(receipt, dict):
        fail("receipt must be a JSON object")
    required = [
        "schema_version", "trip_id", "objective", "origin", "worker",
        "status", "started_at", "finished_at", "outputs", "checks",
        "compounding_assets", "limitations", "external_effect", "revenue_claim",
    ]
    missing = [key for key in required if key not in receipt]
    if missing:
        fail("missing required fields: " + ", ".join(missing))
    if receipt["schema_version"] != 1:
        fail("unsupported schema_version; expected 1")
    for key in ("trip_id", "objective", "started_at", "finished_at"):
        if not isinstance(receipt[key], str) or not receipt[key].strip():
            fail(f"{key} must be a non-empty string")
    if receipt["status"] not in STATUSES:
        fail("status must be SUCCEEDED, FAILED, or BLOCKED")
    if not isinstance(receipt["outputs"], list):
        fail("outputs must be a list")
    if not isinstance(receipt["checks"], list):
        fail("checks must be a list")
    if not isinstance(receipt["compounding_assets"], list):
        fail("compounding_assets must be a list")
    if not isinstance(receipt["limitations"], list):
        fail("limitations must be a list")
    if receipt["external_effect"] not in {"NOT_ATTEMPTED", "BLOCKED", "OBSERVED", "UNKNOWN"}:
        fail("invalid external_effect label")
    if receipt["revenue_claim"] not in {"NONE", "UNVERIFIED", "VERIFIED"}:
        fail("invalid revenue_claim label")
    if receipt["revenue_claim"] == "VERIFIED":
        evidence = receipt.get("revenue_evidence")
        if not isinstance(evidence, list) or not evidence:
            fail("VERIFIED revenue requires a non-empty revenue_evidence list")
    if receipt["external_effect"] == "OBSERVED":
        evidence = receipt.get("external_evidence")
        if not isinstance(evidence, list) or not evidence:
            fail("OBSERVED external effect requires a non-empty external_evidence list")
    messages: list[str] = []
    for index, output in enumerate(receipt["outputs"]):
        if not isinstance(output, dict):
            fail(f"outputs[{index}] must be an object")
        for key in ("path", "sha256", "media_type"):
            if not isinstance(output.get(key), str) or not output[key]:
                fail(f"outputs[{index}].{key} is required")
        if not SHA256_RE.fullmatch(output["sha256"]):
            fail(f"outputs[{index}].sha256 must be 64 lowercase hex characters")
        path = safe_output_path(root, output["path"])
        if not path.is_file():
            fail(f"output file not found: {output['path']}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != output["sha256"]:
            fail(f"SHA-256 mismatch: {output['path']}")
        messages.append(f"HASH_OK {output['path']} {digest}")
    for index, check in enumerate(receipt["checks"]):
        if not isinstance(check, dict) or check.get("status") not in CHECK_STATUSES:
            fail(f"checks[{index}] must be an object with PASS, FAIL, or NOT_RUN status")
        if not isinstance(check.get("name"), str) or not check["name"].strip():
            fail(f"checks[{index}].name is required")
    if receipt["status"] == "SUCCEEDED" and any(c["status"] == "FAIL" for c in receipt["checks"]):
        fail("SUCCEEDED receipt cannot contain a failing check")
    if receipt["status"] == "SUCCEEDED" and not receipt["compounding_assets"]:
        if not any("NO_REUSABLE_ASSET" in str(item) for item in receipt["limitations"]):
            fail("successful trip must list a compounding asset or explain NO_REUSABLE_ASSET in limitations")
    messages.append(f"RECEIPT_VALID trip_id={receipt['trip_id']} status={receipt['status']}")
    messages.append("NOTE Package integrity is not proof of task correctness, external effect, or revenue.")
    return messages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_root", type=Path, help="Root directory containing the receipt and outputs")
    parser.add_argument("--receipt", default="round_trip_receipt.json", help="Receipt path relative to package root")
    args = parser.parse_args()
    root = args.package_root.resolve()
    try:
        receipt_path = safe_output_path(root, args.receipt)
        if not receipt_path.is_file():
            fail(f"receipt not found: {args.receipt}")
        for line in validate(root, receipt_path):
            print(line)
        return 0
    except (OSError, json.JSONDecodeError, ValueError, TypeError) as exc:
        print(f"RECEIPT_INVALID {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())