"""DreamLedger 777: SaaS Leakage / Reconciliation Test Cell.

Offline deterministic fixture processor. This is a candidate detector, not
economic proof. It never contacts GitHub, Stripe, Supabase, or any external
account and never promotes revenue.

The cell deliberately does not infer that the 150 paid seats are all observed.
Only explicitly observed, actively assigned, billed seats are evaluated.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_FIXTURE = Path(r"D:\BrownEyeCortex\fixtures\saas_inventory_fixture.json")
DEFAULT_OUTPUT_DIR = Path(r"D:\BrownEyeCortex\proof\dreamledger")
THRESHOLD_DAYS = 60


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def reconcile(fixture_path: Path = DEFAULT_FIXTURE) -> dict[str, Any]:
    raw = fixture_path.read_bytes()
    data = json.loads(raw.decode("utf-8"))

    if data.get("fixture_status") != "SYNTHETIC_OFFLINE_TEST_ONLY":
        raise ValueError("Fixture must explicitly declare synthetic offline status")

    client = data["client_metadata"]
    contract = data["billing_contract"]
    policy = data["reconciliation_policy"]
    domain = client["corporate_domain"]
    threshold = int(policy["inactivity_threshold_days"])
    seat_cost = float(contract["seat_license_cost_nzd"])

    candidates: list[dict[str, Any]] = []
    anomalies: list[dict[str, Any]] = []

    for user in data["observed_resource_usage"]:
        email = str(user.get("email", ""))
        if not email.endswith("@" + domain):
            anomalies.append({"user_id": user.get("user_id"), "reason": "DOMAIN_MISMATCH"})
            continue
        if policy["require_active_license_assignment"] and not user.get("active_license_assignment"):
            continue
        if policy["require_billing_member"] and not user.get("billing_member"):
            continue

        days = int(user["days_since_last_commit"])
        if days >= threshold:
            candidates.append(
                {
                    "user_id": user["user_id"],
                    "days_since_last_commit": days,
                    "monthly_seat_cost_nzd": seat_cost,
                    "classification": "INACTIVITY_CANDIDATE",
                }
            )

    observed_billed_seats = sum(
        1
        for u in data["observed_resource_usage"]
        if u.get("active_license_assignment") and u.get("billing_member")
    )
    monthly_candidate_value = round(len(candidates) * seat_cost, 2)
    platform_recovery_value = round(monthly_candidate_value * 0.20, 2)

    return {
        "schema_version": "BEC-SAAS-LEAKAGE-CELL-1.0",
        "cell_id": "cell_saas_leakage_github_v1",
        "fixture_status": "SYNTHETIC_OFFLINE_TEST_ONLY",
        "input_sha256": _sha256_bytes(raw),
        "snapshot_id": data["snapshot_id"],
        "client_id": client["client_id"],
        "target_domain": domain,
        "provider": contract["provider"],
        "currency": contract["currency"],
        "threshold_days": threshold,
        "billing_contract_total_licenses_paid": contract["total_licenses_paid"],
        "observed_billed_seats_evaluated": observed_billed_seats,
        "do_not_extrapolate_unobserved_seats": policy["do_not_extrapolate_unobserved_seats"],
        "mismatch_metrics": {
            "inactive_candidate_count": len(candidates),
            "inactive_candidate_user_ids": [c["user_id"] for c in candidates],
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
        },
        "financial_projection": {
            "candidate_monthly_value_nzd": monthly_candidate_value,
            "platform_recovery_value_nzd": platform_recovery_value,
            "platform_take_rate_pct": 20.0,
        },
        "economic_truth": {
            "stage": "TEST",
            "verified_external_revenue_nzd": 0.00,
            "independent_buyer": False,
            "settled_payment": False,
            "fulfillment_verified": False,
            "causal_attribution_verified": False,
            "replication_authorized": False,
        },
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def archive(manifest: dict[str, Any], output_dir: Path = DEFAULT_OUTPUT_DIR) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    payload = json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8")
    path = output_dir / f"saas_leakage_fixture_reconciliation_{stamp}.json"
    path.write_bytes(payload)
    (output_dir / f"saas_leakage_fixture_reconciliation_{stamp}.sha256").write_text(
        f"{_sha256_bytes(payload)}  {path.name}\n", encoding="ascii"
    )
    return path


if __name__ == "__main__":
    manifest = reconcile()
    path = archive(manifest)
    print(json.dumps({
        "status": "TEST_CELL_COMPLETE",
        "artifact": str(path),
        "inactive_candidate_count": manifest["mismatch_metrics"]["inactive_candidate_count"],
        "candidate_monthly_value_nzd": manifest["financial_projection"]["candidate_monthly_value_nzd"],
        "platform_recovery_value_nzd": manifest["financial_projection"]["platform_recovery_value_nzd"],
        "verified_external_revenue_nzd": 0.00,
        "replication_authorized": False,
    }, indent=2))
