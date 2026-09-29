#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone


def get_json(url: str, timeout: int = 10) -> tuple[int, object]:
    req = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8", "replace")
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                body = {"raw": raw}
            return response.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"raw": raw}
        return exc.code, body
    except Exception as exc:
        return 0, {"error": type(exc).__name__, "message": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only DreamLedger revenue gateway probe")
    parser.add_argument("--gateway-url", default=os.getenv("REVENUE_GATEWAY_URL", ""))
    parser.add_argument("--sku", default="QUOTE-COMPARE-49")
    parser.add_argument("--timeout", type=int, default=10)
    args = parser.parse_args()

    if not args.gateway_url:
        print(json.dumps({
            "artifact_type": "REVENUE_GATEWAY_PROBE",
            "truth_status": "UNVERIFIED",
            "sku": args.sku,
            "checks": [],
            "economic_effect": 0,
            "status": "LIVE_VERIFICATION_REQUIRED",
        }, indent=2))
        return 2

    base = args.gateway_url.rstrip("/")
    status_code, body = get_json(f"{base}/status/{args.sku}", args.timeout)
    result = {
        "artifact_type": "REVENUE_GATEWAY_PROBE",
        "truth_status": "UNVERIFIED",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "sku": args.sku,
        "http_status": status_code,
        "gateway": body,
        "checks": [
            {"name": "gateway_status", "status": "OBSERVED" if status_code == 200 else "FAILED"}
        ],
        "economic_effect": 0,
        "side_effects": {
            "payment_created": False,
            "order_created": False,
            "external_dispatch": False,
            "economic_truth_mutated": False,
        },
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if status_code == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())
