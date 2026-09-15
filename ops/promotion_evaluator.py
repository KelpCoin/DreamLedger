#!/usr/bin/env python3
"""Mechanical promotion ladder. No LLM judgement can advance a state."""
import json
import sys

ORDER = [
    "CANDIDATE", "PROBE_READY", "HUMAN_APPROVED", "LIVE",
    "PURCHASED", "SETTLED", "FULFILLED", "PROMOTED", "CLONED",
]


def next_state(cur: str, ev: dict) -> dict:
    if cur not in ORDER:
        return {"state": "CANDIDATE", "reason": "unknown_state"}

    if cur == "CANDIDATE" and ev.get("probe_ready") is True:
        return {"state": "PROBE_READY"}
    if cur == "PROBE_READY" and ev.get("human_approval") is True:
        return {"state": "HUMAN_APPROVED"}
    if cur == "HUMAN_APPROVED" and isinstance(ev.get("public_offer_url"), str) and ev["public_offer_url"]:
        return {"state": "LIVE"}
    if cur == "LIVE" and isinstance(ev.get("checkout_session_id"), str) and ev["checkout_session_id"]:
        return {"state": "PURCHASED"}
    if cur == "PURCHASED" and ev.get("settled_payment_event_id") and ev.get("livemode") is True:
        return {"state": "SETTLED"}
    if cur == "SETTLED" and isinstance(ev.get("fulfillment_artifact_sha256"), str) and len(ev["fulfillment_artifact_sha256"]) == 64:
        return {"state": "FULFILLED"}
    if cur == "FULFILLED" and ev.get("economic_proof_hash"):
        return {"state": "PROMOTED"}
    if cur == "PROMOTED" and ev.get("repeat_revenue_days", 0) >= 60 and ev.get("buyers_requesting_productisation", 0) >= 3:
        return {"state": "CLONED"}

    return {"state": cur, "reason": "insufficient_evidence_for_next_rung"}


if __name__ == "__main__":
    cur = sys.argv[1] if len(sys.argv) > 1 else "CANDIDATE"
    ev = json.load(sys.stdin)
    print(json.dumps(next_state(cur, ev), indent=2, sort_keys=True))
