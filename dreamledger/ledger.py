"""Append-only local evidence log.

Every commercial action gets one JSON line, hash-chained. This is an
execution/evidence artifact, not a database or service.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

LEDGER = Path("dreamledger/events.jsonl")


def _prev_hash() -> str:
    if not LEDGER.exists():
        return "0" * 64
    last = None
    for line in LEDGER.read_text(encoding="utf-8").splitlines():
        if line.strip():
            last = line
    if last is None:
        return "0" * 64
    return json.loads(last)["event_hash"]


def record(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    prev = _prev_hash()
    entry = {"ts": time.time(), "kind": kind, "payload": payload, "prev_hash": prev}
    canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
    entry["event_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, sort_keys=True) + "\n")
    return entry


def verify() -> dict[str, Any]:
    if not LEDGER.exists():
        return {"ok": True, "checked": 0, "broken_at": None}
    prev = "0" * 64
    count = 0
    for i, line in enumerate(LEDGER.read_text(encoding="utf-8").splitlines()):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            if entry["prev_hash"] != prev:
                return {"ok": False, "checked": count, "broken_at": i}
            sealed = dict(entry)
            sealed.pop("event_hash", None)
            canonical = json.dumps(sealed, sort_keys=True, separators=(",", ":"))
            expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            if expected != entry["event_hash"]:
                return {"ok": False, "checked": count, "broken_at": i}
            prev = entry["event_hash"]
            count += 1
        except (KeyError, json.JSONDecodeError, TypeError):
            return {"ok": False, "checked": count, "broken_at": i}
    return {"ok": True, "checked": count, "broken_at": None}
