#!/usr/bin/env python3
"""Create a synthetic package for testing the existing receipt verifier."""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main():
    if len(sys.argv) != 2:
        print("usage: create_round_trip_smoke_package.py OUTPUT_DIRECTORY", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    root.mkdir(parents=True, exist_ok=True)
    artifact = root / "compounding_artifact.txt"
    artifact.write_text("TEST ONLY: synthetic artifact; no external action or revenue.\n", encoding="utf-8")
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    receipt = {"schema_version": 1, "trip_id": "ci-smoke-" + digest[:16], "objective": "Exercise the receipt verifier with synthetic data", "origin": {"surface": "GitHub Actions"}, "worker": {"environment": "ubuntu-latest", "model": "none"}, "status": "SUCCEEDED", "started_at": now, "finished_at": now, "outputs": [{"path": "compounding_artifact.txt", "sha256": digest, "media_type": "text/plain"}], "checks": [{"name": "synthetic-output-hash", "status": "PASS", "evidence": digest}], "compounding_assets": [{"path": "compounding_artifact.txt", "rationale": "Test-only package wiring"}], "limitations": ["TEST_ONLY", "Does not prove local execution, external effect, or revenue"], "external_effect": "NOT_ATTEMPTED", "revenue_claim": "NONE"}
    (root / "round_trip_receipt.json").write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("TRUTH_STATUS=TEST")
    print("VERIFIED_EXTERNAL_REVENUE_NZD=0.00")
    print("ARTIFACT_SHA256=" + digest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
