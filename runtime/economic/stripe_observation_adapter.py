"""Read-only Stripe observation adapter.

Maps supplied processor observations into canonical commerce events.
It never calls Stripe, writes state, attributes buyers, or declares revenue.
"""
from __future__ import annotations

from typing import Any


def project_stripe_payment(row: dict[str, Any]) -> dict[str, Any]:
    status = str(row.get("status") or "").lower()
    event_type = {
        "processing": "PAYMENT_ATTEMPTED",
        "requires_action": "PAYMENT_ATTEMPTED",
        "requires_payment_method": "PAYMENT_ATTEMPTED",
        "succeeded": "PAYMENT_SETTLED",
        "settled": "PAYMENT_SETTLED",
        "failed": "PAYMENT_FAILED",
        "canceled": "PAYMENT_FAILED",
        "cancelled": "PAYMENT_FAILED",
    }.get(status)

    if event_type != "PAYMENT_SETTLED":
        return {
            "result": "OBSERVATION_ONLY",
            "event_type": event_type,
            "settlement_supported": False,
        }

    settlement_evidence = bool(row.get("settlement_evidence"))
    independent_buyer = bool(row.get("independent_buyer"))
    if not settlement_evidence:
        return {
            "result": "EXACT_BLOCKER",
            "event_type": "PAYMENT_SETTLED",
            "error_class": "SETTLEMENT_FAILURE",
            "dependency_state": "SETTLEMENT_EVIDENCE_MISSING",
            "missing_field": "settlement_evidence",
        }

    if not independent_buyer:
        return {
            "result": "EXACT_BLOCKER",
            "event_type": "PAYMENT_SETTLED",
            "error_class": "COUNTERPARTY_FAILURE",
            "dependency_state": "BUYER_UNATTRIBUTED",
            "missing_field": "independent_buyer",
        }

    return {
        "result": "NEXT_STATE",
        "event_type": "PAYMENT_SETTLED",
        "settlement_supported": True,
        "buyer_attributed": True,
    }
