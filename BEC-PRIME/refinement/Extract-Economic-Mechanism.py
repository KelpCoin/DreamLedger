#!/usr/bin/env python3
"""Extract a mechanism candidate from one verified BusinessTruth event.

This is intentionally conservative: it creates a candidate from evidence,
never upgrades a hypothesis to VERIFIED by itself.
"""
import json
import sys
from datetime import datetime, timezone

REQUIRED = ("buyer_class", "signal_class", "offer_class", "distribution_surface",
            "price", "fulfillment_class", "settlement", "evidence")

def extract(event):
    missing = [k for k in REQUIRED if k not in event]
    if missing:
        raise ValueError("missing evidence fields: " + ",".join(missing))
    return {
        "mechanism_id": "MECH-" + str(event.get("economic_event_id", "UNKNOWN")),
        "signal_class": event["signal_class"],
        "offer_class": event["offer_class"],
        "buyer_class": event["buyer_class"],
        "distribution_surface": event["distribution_surface"],
        "pricing": event["price"],
        "fulfillment_class": event["fulfillment_class"],
        "settlement": event["settlement"],
        "transfer_conditions": event.get("transfer_conditions", []),
        "failure_modes": event.get("failure_modes", []),
        "evidence": event["evidence"],
        "status": "CANDIDATE",
        "extracted_at": datetime.now(timezone.utc).isoformat()
    }

if __name__ == "__main__":
    payload = json.load(sys.stdin)
    print(json.dumps(extract(payload), separators=(",", ":"), sort_keys=True))
