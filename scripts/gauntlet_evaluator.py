#!/usr/bin/env python3
"""CI-only policy gauntlet. Never mutates runtime or unlocks local authority."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def load_scorecard(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def evaluate_candidate(scorecard: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    results: dict[str, Any] = {
        "candidate_id": candidate.get("id", "unknown"),
        "passed": True,
        "score": 100,
        "violations": [],
        "authority": "CI_READ_ONLY",
        "mutates_runtime": False,
    }

    allowed_rails = set(scorecard.get("allowed_payment_rails", ["stripe_nzd"]))
    for rail in candidate.get("supported_payment_rails", []):
        if rail not in allowed_rails:
            results["passed"] = False
            results["score"] -= 40
            results["violations"].append(f"Unauthorized payment rail: {rail}")

    rules = scorecard.get("rules", {})
    if rules.get("checkout_enabled_requires_durable_quota") and candidate.get("checkout_enabled") is True:
        if not candidate.get("durable_quota_ledger", False):
            results["passed"] = False
            results["score"] -= 50
            results["violations"].append("checkout_enabled without durable_quota_ledger")

    if rules.get("forbid_fake_revenue_claims") and candidate.get("claims_verified_revenue") is True:
        if not candidate.get("independent_settlement_evidence", False):
            results["passed"] = False
            results["score"] -= 50
            results["violations"].append("claims_verified_revenue without independent_settlement_evidence")

    if candidate.get("type") == "TRUTH_ORACLE_CHANGE" and rules.get("pii_sanitization_required_for_oracle_ingest"):
        if not candidate.get("pii_sanitization_active", False):
            results["passed"] = False
            results["score"] -= 50
            results["violations"].append("Truth Oracle change missing pii_sanitization_active")

    estimated_margin = float(candidate.get("unit_margin_nzd", 0.0))
    min_margin = float(scorecard.get("min_unit_margin_nzd", 0.0))
    if estimated_margin < min_margin:
        results["passed"] = False
        results["score"] -= 30
        results["violations"].append(f"Margin {estimated_margin} below threshold {min_margin}")

    threshold = int(scorecard.get("pass_score_threshold", 85))
    if results["score"] < threshold:
        results["passed"] = False

    return results


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    scorecard_path = root / "scorecards" / "current_policy.json"
    if not scorecard_path.is_file():
        print(json.dumps({"passed": False, "error": f"missing {scorecard_path}"}))
        return 2

    scorecard = load_scorecard(scorecard_path)

    # Default candidate: current production truth bounds (must pass).
    candidate = {
        "id": "policy_baseline_live",
        "supported_payment_rails": ["stripe_nzd"],
        "checkout_enabled": False,
        "durable_quota_ledger": False,
        "claims_verified_revenue": False,
        "independent_settlement_evidence": False,
        "unit_margin_nzd": 0.0,
    }

    candidate_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if candidate_path and candidate_path.is_file():
        with candidate_path.open(encoding="utf-8") as f:
            candidate = json.load(f)

    result = evaluate_candidate(scorecard, candidate)
    print(json.dumps(result, indent=2))
    return 0 if result.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
