#!/usr/bin/env python3
"""Report economic loop registry status. Optional live probes with --live."""
from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REG = ROOT / "AGENT_BUS" / "ECONOMIC-LOOPS" / "registry.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    args = ap.parse_args()

    reg = json.loads(REG.read_text(encoding="utf-8"))
    loops = reg.get("loops", [])
    out = {
        "schema": "dreamledger/loop-status/v1",
        "verified_external_revenue_nzd": reg.get("verified_external_revenue_nzd", 0),
        "loop_count": len(loops),
        "internet_facing": [x["loop_id"] for x in loops if x.get("internet_facing")],
        "live_offers": [x["loop_id"] for x in loops if x.get("status") == "live_offer"],
        "candidates": [x["loop_id"] for x in loops if x.get("status") == "candidate"],
        "loops": [],
    }

    for loop in loops:
        row = {
            "loop_id": loop.get("loop_id"),
            "name": loop.get("name"),
            "status": loop.get("status"),
            "internet_facing": loop.get("internet_facing"),
            "priority": loop.get("priority"),
            "price_nzd": loop.get("price_nzd"),
        }
        if args.live and loop.get("buy_url") and str(loop["buy_url"]).startswith("http"):
            try:
                req = urllib.request.Request(
                    loop["buy_url"],
                    method="GET",
                    headers={"User-Agent": "DreamLedger-loop-status/1.0"},
                )
                with urllib.request.urlopen(req, timeout=20) as r:
                    row["live_http"] = r.status
                    row["live_final"] = r.geturl()
            except Exception as e:
                row["live_error"] = str(e)
        out["loops"].append(row)

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
