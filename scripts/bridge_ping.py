#!/usr/bin/env python3
"""
Air-gap / local Agent Bridge ping writer.
Creates a ping JSON under AGENT_BUS/BRIDGE/outbox (or local_queue).
Does not claim revenue. Does not call external APIs unless --check-live.

Usage:
  python3 scripts/bridge_ping.py --from local-pc --summary "aligned tile plink" --ball C
  python3 scripts/bridge_ping.py --check-live   # optional online probe
"""
from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTBOX = ROOT / "AGENT_BUS" / "BRIDGE" / "outbox"
LOCAL_Q = ROOT / "AGENT_BUS" / "BRIDGE" / "local_queue"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> None:
    ap = argparse.ArgumentParser(description="Write an Agent Bridge ping")
    ap.add_argument("--from", dest="frm", default="local-operator")
    ap.add_argument("--mode", choices=("airgap", "cloud", "hybrid"), default="airgap")
    ap.add_argument("--ball", default="C")
    ap.add_argument("--intent", default="handoff")
    ap.add_argument("--summary", required=True)
    ap.add_argument("--local-queue", action="store_true", help="Write to local_queue until online push")
    ap.add_argument("--check-live", action="store_true", help="Optional GET dreamledger.org/version")
    args = ap.parse_args()

    dest = LOCAL_Q if args.local_queue else OUTBOX
    dest.mkdir(parents=True, exist_ok=True)

    ping_id = f"ping-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}-{uuid.uuid4().hex[:6]}"
    ping = {
        "schema": "dreamledger/agent-bridge-ping/v1",
        "ping_id": ping_id,
        "from": args.frm,
        "mode": args.mode,
        "ball": args.ball,
        "intent": args.intent,
        "summary": args.summary,
        "reads": ["AGENT_BUS/PING_PONG_BALLS.json", "AGENT_BUS/ECONOMIC-LOOPS/registry.json"],
        "writes": [str(dest.relative_to(ROOT) / f"{ping_id}.json")],
        "revenue_claim_nzd": 0,
        "needs_human": args.ball == "C",
        "created_at": utc_now(),
    }

    if args.check_live:
        try:
            import urllib.request

            with urllib.request.urlopen("https://dreamledger.org/version", timeout=15) as r:
                ping["live_version_status"] = r.status
                ping["live_version_body"] = r.read()[:500].decode("utf-8", "replace")
        except Exception as e:
            ping["live_version_error"] = str(e)

    path = dest / f"{ping_id}.json"
    path.write_text(json.dumps(ping, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "path": str(path), "revenue_claim_nzd": 0}, indent=2))


if __name__ == "__main__":
    main()
