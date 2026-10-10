#!/usr/bin/env python3
"""Read-only Elohim observer: live surface checks. Never mutates runtime or unlocks authority."""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone

BASE = "https://dreamledger.org"
PATHS = [
    "/api/toll/v1/manifest",
    "/api/products",
    "/privacy",
    "/terms",
    "/security",
    "/contact",
    "/shop.html",
    "/mtg/",
]


def fetch(path: str) -> dict:
    url = BASE + path
    try:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "DreamLedger-ElohimObserve/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read(2000)
            return {"path": path, "status": resp.status, "ok": 200 <= resp.status < 400, "bytes": len(body)}
    except Exception as e:
        return {"path": path, "status": None, "ok": False, "error": str(e)}


def main() -> int:
    checks = [fetch(p) for p in PATHS]
    report = {
        "schema": "dreamledger.elohim.observe.v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "mutates_runtime": False,
        "auto_unlock": False,
        "verified_external_revenue_nzd": 0,
        "checks": checks,
        "fail_count": sum(1 for c in checks if not c.get("ok")),
    }
    print(json.dumps(report, indent=2))
    return 0 if report["fail_count"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
