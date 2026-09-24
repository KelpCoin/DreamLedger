#!/usr/bin/env python3
"""Mark a distribution queue job sent/skipped. Local operator tool."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "ops" / "money" / "distribution_queue.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("job_id")
    ap.add_argument("--status", choices=("sent", "skipped", "pending_human"), default="sent")
    ap.add_argument("--note", default="")
    args = ap.parse_args()

    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    found = False
    for job in data.get("jobs", []):
        if job.get("job_id") == args.job_id:
            job["status"] = args.status
            job["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            if args.note:
                job["note"] = args.note
            found = True
            break
    if not found:
        raise SystemExit(f"unknown job_id: {args.job_id}")
    data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    QUEUE.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "job_id": args.job_id, "status": args.status}, indent=2))


if __name__ == "__main__":
    main()
