#!/usr/bin/env python3
"""Print Phase-1 commercial cell status + next permitted transition."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CELLS = ROOT / "ops" / "commercial" / "cells"


def main() -> None:
    out = []
    for path in sorted(CELLS.glob("CELL-*.json")):
        cell = json.loads(path.read_text(encoding="utf-8"))
        status = cell.get("status", "unknown")
        nxt = {
            "draft": "qualify opportunity",
            "qualified": "authorize (human)",
            "authorized": "DISTRIBUTE — post buy_url",
            "active": "await payment / fulfil",
            "won": "record learning; optional experiment 002",
            "lost": "diagnose or abandon",
            "abandoned": "stop",
        }.get(status, "unknown")
        out.append(
            {
                "file": path.name,
                "opportunity_id": cell.get("opportunity_id"),
                "status": status,
                "buy_url": cell.get("proposed_offer", {}).get("buy_url"),
                "price_nzd": cell.get("proposed_offer", {}).get("price_nzd"),
                "next_permitted": nxt,
                "do_now": cell.get("do_now"),
            }
        )
    print(json.dumps({"cells": out, "verified_external_revenue_nzd": 0}, indent=2))


if __name__ == "__main__":
    main()
