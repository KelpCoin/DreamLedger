#!/usr/bin/env python3
"""Evidence-gated CUBE scaling recommendation.

This module is deliberately decision-only. It never creates, terminates, or resizes
workers and never calls a payment provider. It refuses to recommend scaling unless
an upstream provider-backed reconciliation bundle is explicitly verified.
"""
from __future__ import annotations

import math
import re
from typing import Any

SCHEMA = "bec/cube-scale-evidence/v2"
EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
EPV_PRUNE_FLOOR_NZD = 25.0
EPV_CLONE_THRESHOLD_NZD = 120.0
MAX_WORKERS = 64
MIN_DISTINCT_BUYERS = 3
MIN_WINDOW_DAYS = 7


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(float(value)):
        return None
    return float(value)


def _hold(reason: str, *, blockers: list[str] | None = None) -> dict[str, Any]:
    return {
        "schema": "bec/cube-scale-decision/v1",
        "decision": "HOLD_BASELINE_PREPARE_ONLY",
        "recommended_worker_count": 1,
        "scale_recommended": False,
        "execute_scale": False,
        "production_mutation": False,
        "revenue_claimed_by_gate_nzd": 0.0,
        "net_contribution_margin_nzd": None,
        "observed_epv_nzd": None,
        "verified_order_count": 0,
        "distinct_buyer_count": 0,
        "reason": reason,
        "blockers": blockers or [reason],
    }


def recommend_scale(evidence: dict[str, Any]) -> dict[str, Any]:
    """Return a recommendation from a provider-verified evidence bundle.

    Required evidence fields are intentionally strict. The upstream reconciliation
    system, not this pure function, must verify provider signatures and evidence.
    All currency amounts supplied here must already be normalized to NZD. Gross
    GMV is not platform revenue: contribution is platform revenue less costs borne
    by the platform. This distinction is critical for zero-fee P2P marketplaces.
    """
    if not isinstance(evidence, dict) or evidence.get("schema") != SCHEMA:
        return _hold("INVALID_OR_MISSING_EVIDENCE_SCHEMA")

    bundle = evidence.get("verified_bundle")
    if not isinstance(bundle, dict):
        return _hold("MISSING_PROVIDER_VERIFIED_BUNDLE")
    if bundle.get("status") != "VERIFIED" or bundle.get("signature_verified") is not True:
        return _hold("SETTLEMENT_BUNDLE_NOT_PROVIDER_VERIFIED")
    if not str(bundle.get("reconciliation_id", "")).strip():
        return _hold("MISSING_RECONCILIATION_ID")
    if not str(bundle.get("verified_at_utc", "")).strip():
        return _hold("MISSING_EVIDENCE_TIMESTAMP")
    if bundle.get("source") not in {"stripe_reconciliation", "x402_chain_verifier"}:
        return _hold("UNSUPPORTED_SETTLEMENT_EVIDENCE_SOURCE")

    window_days = _number(evidence.get("window_days"))
    visitors = _number(evidence.get("unique_qualified_visitors"))
    if window_days is None or window_days < MIN_WINDOW_DAYS:
        return _hold("OBSERVATION_WINDOW_TOO_SHORT")
    if visitors is None or visitors <= 0:
        return _hold("MISSING_QUALIFIED_VISITOR_DENOMINATOR")

    orders = evidence.get("orders")
    if not isinstance(orders, list) or not orders:
        return _hold("NO_SETTLED_ORDER_EVIDENCE")

    seen_payments: set[str] = set()
    seen_sessions: set[str] = set()
    seen_events: set[str] = set()
    verified_orders: list[dict[str, Any]] = []
    blockers: list[str] = []

    for index, order in enumerate(orders):
        if not isinstance(order, dict):
            blockers.append(f"ORDER_{index}_NOT_OBJECT")
            continue
        if order.get("settlement_status") != "SETTLED":
            blockers.append(f"ORDER_{index}_NOT_SETTLED")
            continue
        if order.get("attribution_status") != "VERIFIED":
            blockers.append(f"ORDER_{index}_ATTRIBUTION_UNVERIFIED")
            continue
        if order.get("fulfillment_status") != "FULFILLED":
            blockers.append(f"ORDER_{index}_NOT_FULFILLED")
            continue
        if order.get("independent_external_buyer") is not True:
            blockers.append(f"ORDER_{index}_BUYER_NOT_INDEPENDENT")
            continue
        if order.get("settlement_proof_status") != "VERIFIED":
            blockers.append(f"ORDER_{index}_SETTLEMENT_PROOF_UNVERIFIED")
            continue
        if order.get("delivery_proof_status") != "VERIFIED":
            blockers.append(f"ORDER_{index}_DELIVERY_PROOF_UNVERIFIED")
            continue

        proof_hash = str(order.get("delivery_proof_sha256", "")).lower()
        if not HEX64.fullmatch(proof_hash) or proof_hash == EMPTY_SHA256 or proof_hash == "0" * 64:
            blockers.append(f"ORDER_{index}_INVALID_OR_EMPTY_DELIVERY_HASH")
            continue

        payment_id = str(order.get("payment_id", "")).strip()
        buyer_key_hash = str(order.get("buyer_key_hash", "")).lower()
        event_id = str(order.get("provider_event_id", "")).strip()
        session_id = str(order.get("stripe_session_id", "")).strip()
        x402_hash = str(order.get("x402_tx_hash", "")).strip()
        payment_key = session_id or x402_hash

        if not payment_id or not payment_key or not event_id:
            blockers.append(f"ORDER_{index}_MISSING_IDEMPOTENCY_IDENTIFIERS")
            continue
        if not HEX64.fullmatch(buyer_key_hash):
            blockers.append(f"ORDER_{index}_BUYER_IDENTITY_NOT_HASHED")
            continue
        if payment_id in seen_payments or payment_key in seen_sessions or event_id in seen_events:
            blockers.append(f"ORDER_{index}_DUPLICATE_PAYMENT_EVENT_OR_SESSION")
            continue

        gross_amount = _number(order.get("gross_amount_nzd"))
        platform_revenue = _number(order.get("platform_revenue_nzd"))
        fees = _number(order.get("processor_fees_nzd"))
        fulfilment_cost = _number(order.get("direct_fulfillment_cost_nzd"))
        provider_cost = _number(order.get("provider_cost_nzd"))
        gross_refund = _number(order.get("refund_amount_nzd", 0.0))
        platform_refund_cost = _number(order.get("refund_cost_nzd"))
        if any(v is None for v in (
            gross_amount, platform_revenue, fees, fulfilment_cost,
            provider_cost, gross_refund, platform_refund_cost
        )):
            blockers.append(f"ORDER_{index}_INVALID_COST_OR_AMOUNT")
            continue
        if (
            gross_amount <= 0
            or platform_revenue < 0
            or min(fees, fulfilment_cost, provider_cost, gross_refund, platform_refund_cost) < 0
            or gross_refund > gross_amount
        ):
            blockers.append(f"ORDER_{index}_NEGATIVE_OR_INVALID_AMOUNT")
            continue
        if gross_refund >= gross_amount:
            blockers.append(f"ORDER_{index}_FULLY_REFUNDED_NOT_COUNTED")
            continue

        seen_payments.add(payment_id)
        seen_sessions.add(payment_key)
        seen_events.add(event_id)
        verified_orders.append({
            "buyer_key_hash": buyer_key_hash,
            "gross_gmv_nzd": gross_amount,
            "platform_revenue_nzd": platform_revenue,
            "contribution_nzd": (
                platform_revenue - fees - fulfilment_cost - provider_cost - platform_refund_cost
            ),
        })

    # Any rejected row means the source bundle is not a clean scaling sample.
    if blockers:
        return _hold("EVIDENCE_ROWS_FAILED_RECONCILIATION", blockers=blockers)

    distinct_buyers = len({row["buyer_key_hash"] for row in verified_orders})
    if distinct_buyers < MIN_DISTINCT_BUYERS:
        return _hold("INSUFFICIENT_INDEPENDENT_BUYERS", blockers=[
            f"Need at least {MIN_DISTINCT_BUYERS} distinct independent buyers; found {distinct_buyers}."
        ])
    if distinct_buyers > visitors:
        return _hold("BUYER_COUNT_EXCEEDS_QUALIFIED_VISITOR_DENOMINATOR", blockers=[
            f"Observed {distinct_buyers} distinct buyers but only {int(visitors)} qualified visitors."
        ])

    margin = sum(row["contribution_nzd"] for row in verified_orders)
    epv = margin / visitors
    current = _number(evidence.get("current_workers", 1))
    pending = _number(evidence.get("pending_verified_signals", 0))
    capacity = evidence.get("capacity_guardrails")
    if current is None or current < 1 or pending is None or pending < 0:
        return _hold("INVALID_CURRENT_WORKER_OR_QUEUE_METRIC")
    if not isinstance(capacity, dict) or capacity.get("status") != "PASS":
        return _hold("CAPACITY_GUARDRAILS_NOT_PASS")

    if margin <= 0:
        return _hold("NON_POSITIVE_NET_CONTRIBUTION_MARGIN")
    if epv < EPV_PRUNE_FLOOR_NZD:
        target = 1
        decision = "PRUNE_TO_BASELINE_RECOMMENDATION"
    elif epv < EPV_CLONE_THRESHOLD_NZD:
        target = min(MAX_WORKERS, max(1, math.ceil(pending / 10)))
        decision = "QUEUE_DEPTH_SCALE_RECOMMENDATION"
    else:
        target = min(MAX_WORKERS, max(2, int(current) * 2))
        decision = "CLONE_EXPAND_RECOMMENDATION"

    return {
        "schema": "bec/cube-scale-decision/v1",
        "decision": decision,
        "recommended_worker_count": target,
        "scale_recommended": target != int(current),
        "execute_scale": False,
        "production_mutation": False,
        "revenue_claimed_by_gate_nzd": 0.0,
        "net_contribution_margin_nzd": round(margin, 2),
        "gross_gmv_nzd": round(sum(row["gross_gmv_nzd"] for row in verified_orders), 2),
        "platform_revenue_nzd": round(sum(row["platform_revenue_nzd"] for row in verified_orders), 2),
        "observed_epv_nzd": round(epv, 6),
        "verified_order_count": len(verified_orders),
        "distinct_buyer_count": distinct_buyers,
        "evidence_bundle_id": bundle["reconciliation_id"],
        "reason": "Decision-only recommendation from provider-reconciled settlement, attribution, delivery, and cost evidence.",
        "blockers": [],
        "thresholds": {
            "prune_floor_nzd": EPV_PRUNE_FLOOR_NZD,
            "clone_threshold_nzd": EPV_CLONE_THRESHOLD_NZD,
            "max_workers": MAX_WORKERS,
        },
    }


def main() -> int:
    import argparse
    import json
    from pathlib import Path

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence_json", help="Path to upstream verified evidence bundle JSON")
    parser.add_argument("--output", default="cube-swarm-scale-decision.json")
    args = parser.parse_args()
    try:
        evidence = json.loads(Path(args.evidence_json).read_text(encoding="utf-8"))
    except Exception as exc:
        decision = _hold("EVIDENCE_FILE_UNREADABLE", blockers=[type(exc).__name__])
        Path(args.output).write_text(json.dumps(decision, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(decision, indent=2))
        return 2
    decision = recommend_scale(evidence)
    Path(args.output).write_text(json.dumps(decision, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(decision, indent=2))
    return 0 if not decision["blockers"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
