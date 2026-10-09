#!/usr/bin/env python3
"""Minimal append-only failure telemetry collector.
Pure standard library. No network. No secrets.
Usage:
  python failure_collector.py --trip TRIP_ID --class quality --notes "blurry output"
  python failure_collector.py --trip TRIP_ID --class success --notes "final accepted"
"""
from __future__ import annotations

import argparse
import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_LOG = Path("failure_telemetry.jsonl")

def sha256_file(path: Path | None) -> str | None:
    if path is None or not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--trip", required=True, help="trip_id")
    p.add_argument("--class", dest="failure_class", required=True,
                   choices=["timeout", "quality", "policy", "resource", "unknown", "success"])
    p.add_argument("--notes", default="", help="free text")
    p.add_argument("--input", type=Path, default=None, help="optional input file to hash")
    p.add_argument("--output", type=Path, default=None, help="optional output file to hash")
    p.add_argument("--log", type=Path, default=DEFAULT_LOG, help="JSONL log path")
    p.add_argument("--retry", type=int, default=0, help="retry index")
    args = p.parse_args()

    record = {
        "attempt_id": str(uuid.uuid4()),
        "trip_id": args.trip,
        "input_hash": sha256_file(args.input),
        "output_hash": sha256_file(args.output),
        "failure_class": args.failure_class,
        "retry_index": args.retry,
        "notes": args.notes,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    args.log.parent.mkdir(parents=True, exist_ok=True)
    with args.log.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(json.dumps(record, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
