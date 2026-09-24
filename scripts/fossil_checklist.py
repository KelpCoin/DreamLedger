#!/usr/bin/env python3
"""Interactive checklist printer for post-sale fossil. Does not invent evidence."""
from __future__ import annotations

import json
from datetime import datetime, timezone

CHECKLIST = [
    "Stripe Dashboard shows livemode paid session",
    "Amount and currency match approved offer",
    "Buyer is external (not counted self-test as BusinessTruth)",
    "Settlement Sync run completed",
    "Session recognised OR plink misalignment documented",
    "Fulfilment completed (tile published or report delivered)",
    "Buyer notified",
    "Proof bundle written (payment ref + delivery evidence)",
    "AGENT_BUS handoff updated",
    "PING_PONG_BALLS revenue field updated ONLY if rules pass",
]


def main() -> None:
    report = {
        "schema": "dreamledger/fossil-checklist/v1",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "verified_external_revenue_nzd_default": 0,
        "items": [{"step": i + 1, "text": t, "done": False} for i, t in enumerate(CHECKLIST)],
        "note": "Mark done locally after real work. Do not set revenue without external evidence.",
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
