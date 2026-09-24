#!/usr/bin/env python3
"""Process Agent Bridge inbox: validate pings, emit pongs, archive.
Air-gap safe. revenue always 0 in automated pongs.
"""
from __future__ import annotations

import argparse
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "AGENT_BUS" / "BRIDGE" / "inbox"
OUTBOX = ROOT / "AGENT_BUS" / "BRIDGE" / "outbox"
ARCHIVE = ROOT / "AGENT_BUS" / "BRIDGE" / "archive"


def utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from", dest="frm", default="bridge-router")
    args = ap.parse_args()

    INBOX.mkdir(parents=True, exist_ok=True)
    OUTBOX.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    files = sorted(INBOX.glob("*.json"))
    results = []
    for path in files:
        try:
            ping = load_json(path)
        except Exception as e:
            results.append({"file": path.name, "status": "rejected", "error": str(e)})
            continue

        schema = ping.get("schema", "")
        if "agent-bridge-ping" not in schema:
            status, summary = "rejected", "invalid schema"
        elif float(ping.get("revenue_claim_nzd") or 0) > 0:
            status, summary = "rejected", "revenue_claim_nzd must be 0 without fossil"
        else:
            status = "accepted"
            summary = f"accepted ball={ping.get('ball')} intent={ping.get('intent')}"

        pong_id = f"pong-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}-{uuid.uuid4().hex[:6]}"
        pong = {
            "schema": "dreamledger/agent-bridge-pong/v1",
            "pong_id": pong_id,
            "in_reply_to": ping.get("ping_id"),
            "from": args.frm,
            "status": status,
            "summary": summary,
            "verified_external_revenue_nzd": 0,
            "next_ball": ping.get("ball") or "C",
            "created_at": utc(),
        }
        results.append({"file": path.name, "status": status, "pong_id": pong_id})

        if args.dry_run:
            continue

        (OUTBOX / f"{pong_id}.json").write_text(json.dumps(pong, indent=2) + "\n", encoding="utf-8")
        shutil.move(str(path), str(ARCHIVE / path.name))

    print(json.dumps({"ok": True, "processed": len(results), "dry_run": args.dry_run, "results": results}, indent=2))


if __name__ == "__main__":
    main()
