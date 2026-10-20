#!/usr/bin/env python3
"""Evidence-gated CUBE EPV decision evaluator.

Decision only: this module never starts, stops, deploys, or scales a worker.
Verified inputs require an HMAC-SHA256 attestation from a trusted reconciler.
Without the key, valid signature, sample floor, and runtime capability evidence,
the result is HOLD_NO_SCALE. It does not count pipeline value or simulations.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = "BEC-PRIME/CUBE-EPV-EVIDENCE/v1"
REPORT_SCHEMA = "BEC-PRIME/CUBE-EPV-DECISION/v1"
APPLY_ENABLED = False
HEX64 = re.compile(r"^[a-f0-9]{64}$")
KEY_ENV = "CUBE_ECONOMIC_EVIDENCE_HMAC_KEY"
FLOOR_NZD = 25.0
EXPAND_NZD = 120.0
MAX_WORKERS = 64
MIN_TRANSACTIONS = 20
MIN_WINDOW_DAYS = 30


def canonical_payload(payload: dict[str, Any]) -> bytes:
    unsigned = {k: v for k, v in payload.items() if k != "attestation"}
    return json.dumps(unsigned, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def make_attestation_for_trusted_reconciler(payload: dict[str, Any], key: str) -> str:
    """Reconciler helper. Do not expose the key or use this for simulated economic data."""
    return hmac.new(key.encode("utf-8"), canonical_payload(payload), hashlib.sha256).hexdigest()


def valid_sha(value: Any) -> bool:
    return isinstance(value, str) and bool(HEX64.fullmatch(value))


def numeric(payload: dict[str, Any], key: str) -> float | None:
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    if not math.isfinite(value) or value < 0:
        return None
    return value


def verify_evidence(payload: dict[str, Any], hmac_key: str | None) -> tuple[bool, str]:
    if payload.get("schema") != SCHEMA:
        return False, "EVIDENCE_SCHEMA_MISMATCH"
    if payload.get("evidence_class") != "INDEPENDENTLY_RECONCILED_SETTLEMENT_AND_FULFILLMENT":
        return False, "EVIDENCE_CLASS_NOT_ACCEPTED"
    attestation = payload.get("attestation")
    if not isinstance(attestation, dict) or attestation.get("algorithm") != "HMAC-SHA256":
        return False, "ATTESTATION_MISSING_OR_UNSUPPORTED"
    if not hmac_key:
        return False, "ATTESTATION_KEY_NOT_CONFIGURED"
    supplied = attestation.get("signature")
    if not isinstance(supplied, str) or not HEX64.fullmatch(supplied):
        return False, "ATTESTATION_SIGNATURE_MALFORMED"
    expected = make_attestation_for_trusted_reconciler(payload, hmac_key)
    if not hmac.compare_digest(supplied, expected):
        return False, "ATTESTATION_SIGNATURE_INVALID"
    if not valid_sha(payload.get("ledger_export_sha256")):
        return False, "LEDGER_EXPORT_HASH_MISSING"
    if not valid_sha(payload.get("reconciliation_artifact_sha256")):
        return False, "RECONCILIATION_HASH_MISSING"
    if not str(payload.get("external_provider_reference", "")).strip():
        return False, "EXTERNAL_PROVIDER_REFERENCE_MISSING"
    if not str(payload.get("reconciler_build_sha", "")).strip():
        return False, "RECONCILER_BUILD_SHA_MISSING"
    return True, "SIGNED_EVIDENCE_ACCEPTED_FOR_DECISION_ONLY"


def compute_epv(payload: dict[str, Any]) -> float | None:
    settled = numeric(payload, "settled_revenue_nzd")
    refunds = numeric(payload, "refunds_nzd")
    processing = numeric(payload, "processing_fees_nzd")
    fulfillment = numeric(payload, "variable_fulfillment_cost_nzd")
    visitors = numeric(payload, "unique_qualified_visitors")
    if any(v is None for v in (settled, refunds, processing, fulfillment, visitors)):
        return None
    if visitors is None or visitors <= 0:
        return None
    return (settled - refunds - processing - fulfillment) / visitors


def evaluate(payload: dict[str, Any] | None, hmac_key: str | None) -> dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    evidence_ok, evidence_reason = verify_evidence(payload, hmac_key)
    if not evidence_ok:
        return {
            "schema": REPORT_SCHEMA,
            "status": "HOLD_NO_SCALE",
            "action": "HOLD_NO_SCALE",
            "reason": evidence_reason,
            "epv_nzd": None,
            "current_workers": 1,
            "target_workers": 1,
            "apply_enabled": APPLY_ENABLED,
            "verified_revenue_claim_nzd": 0,
            "external_reconciliation_verified_by_this_script": False,
            "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        }

    tx_count = numeric(payload, "settled_and_fulfilled_transactions")
    window_days = numeric(payload, "measurement_window_days")
    pending = numeric(payload, "qualified_pending_signals")
    current_workers = numeric(payload, "current_live_workers")
    budget_cap = numeric(payload, "daily_worker_budget_cap_nzd")
    if tx_count is None or tx_count < MIN_TRANSACTIONS:
        reason = "TRANSACTION_SAMPLE_BELOW_MINIMUM"
    elif window_days is None or window_days < MIN_WINDOW_DAYS:
        reason = "MEASUREMENT_WINDOW_BELOW_MINIMUM"
    elif pending is None:
        reason = "QUALIFIED_QUEUE_DEPTH_MISSING"
    elif current_workers is None or current_workers < 1 or current_workers > MAX_WORKERS:
        reason = "CURRENT_WORKER_COUNT_INVALID"
    elif budget_cap is None or budget_cap <= 0:
        reason = "DAILY_BUDGET_CAP_MISSING"
    else:
        reason = ""

    epv = compute_epv(payload)
    if not reason and epv is None:
        reason = "EPV_INPUTS_INVALID"
    if reason:
        return {
            "schema": REPORT_SCHEMA,
            "status": "HOLD_NO_SCALE",
            "action": "HOLD_NO_SCALE",
            "reason": reason,
            "epv_nzd": epv,
            "current_workers": int(current_workers) if current_workers is not None else 1,
            "target_workers": int(current_workers) if current_workers is not None else 1,
            "apply_enabled": APPLY_ENABLED,
            "verified_revenue_claim_nzd": 0,
            "external_reconciliation_verified_by_this_script": False,
            "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        }

    current = int(current_workers)
    if epv < FLOOR_NZD:
        action, target = "WOULD_PRUNE_TO_BASELINE", 1
    elif epv >= EXPAND_NZD:
        target = min(MAX_WORKERS, max(current + 1, current * 2))
        action = "WOULD_CLONE_EXPAND_SWARM"
    else:
        target = min(MAX_WORKERS, max(1, math.ceil(pending / 10)))
        action = "WOULD_QUEUE_SCALE" if target != current else "HOLD_CURRENT_CAPACITY"

    runtime_gates = {
        "worker_provider_connected": payload.get("worker_provider_connected") is True,
        "durable_queue_connected": payload.get("durable_queue_connected") is True,
        "tenant_fence_tests_passed": payload.get("tenant_fence_tests_passed") is True,
        "duplicate_settlement_replay_tests_passed": payload.get("duplicate_settlement_replay_tests_passed") is True,
        "budget_guard_connected": payload.get("budget_guard_connected") is True,
    }
    all_runtime_gates = all(runtime_gates.values())
    if not all_runtime_gates and target != current:
        action = "HOLD_NO_SCALE_RUNTIME_UNVERIFIED"
        status = "BLOCKED_RUNTIME_CAPABILITY"
        target = current
    else:
        status = "DECISION_READY_NO_ACTION_TAKEN"

    return {
        "schema": REPORT_SCHEMA,
        "status": status,
        "action": action,
        "reason": "Decision only; this program makes no worker-provider calls.",
        "epv_nzd": round(epv, 6),
        "net_contribution_nzd": round(
            float(payload["settled_revenue_nzd"])
            - float(payload["refunds_nzd"])
            - float(payload["processing_fees_nzd"])
            - float(payload["variable_fulfillment_cost_nzd"]),
            2,
        ),
        "current_workers": current,
        "target_workers": target,
        "runtime_gates": runtime_gates,
        "sample": {
            "settled_and_fulfilled_transactions": int(tx_count),
            "measurement_window_days": int(window_days),
            "unique_qualified_visitors": int(float(payload["unique_qualified_visitors"])),
            "qualified_pending_signals": int(pending),
        },
        "policy": {
            "epv_floor_nzd": FLOOR_NZD,
            "winner_expansion_threshold_nzd": EXPAND_NZD,
            "worker_ceiling": MAX_WORKERS,
            "min_transactions": MIN_TRANSACTIONS,
            "min_window_days": MIN_WINDOW_DAYS,
        },
        "apply_enabled": APPLY_ENABLED,
        "verified_revenue_claim_nzd": 0,
        "external_reconciliation_verified_by_this_script": False,
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", help="JSON export from the independently authenticated reconciler.")
    parser.add_argument("--output", default="proof/economic/CUBE-EPV-DECISION.json")
    args = parser.parse_args()
    payload: dict[str, Any] | None = None
    if args.input:
        try:
            payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            payload = None
    key = os.environ.get(KEY_ENV)
    decision = evaluate(payload, key)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(decision, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": decision["status"],
        "action": decision["action"],
        "epv_nzd": decision.get("epv_nzd"),
        "target_workers": decision.get("target_workers"),
        "apply_enabled": APPLY_ENABLED,
        "proof_path": str(out),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
