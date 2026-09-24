#!/usr/bin/env python3
"""Write a pong replying to a ping. revenue always 0 unless operator overrides with evidence flag (still default 0)."""
from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTBOX = ROOT / "AGENT_BUS" / "BRIDGE" / "outbox"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-reply-to", required=True)
    ap.add_argument("--from", dest="frm", default="cloud-agent")
    ap.add_argument("--status", default="accepted", choices=("accepted", "rejected", "blocked", "done"))
    ap.add_argument("--summary", required=True)
    ap.add_argument("--next-ball", default="C")
    args = ap.parse_args()

    OUTBOX.mkdir(parents=True, exist_ok=True)
    pong_id = f"pong-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}-{uuid.uuid4().hex[:6]}"
    pong = {
        "schema": "dreamledger/agent-bridge-pong/v1",
        "pong_id": pong_id,
        "in_reply_to": args.in_reply_to,
        "from": args.frm,
        "status": args.status,
        "summary": args.summary,
        "verified_external_revenue_nzd": 0,
        "next_ball": args.next_ball,
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    path = OUTBOX / f"{pong_id}.json"
    path.write_text(json.dumps(pong, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "path": str(path)}, indent=2))


if __name__ == "__main__":
    main()
