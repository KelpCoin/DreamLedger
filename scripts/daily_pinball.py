#!/usr/bin/env python3
"""Daily pinball status — what the system needs next."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_json(p: Path):
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> None:
    balls = read_json(ROOT / "AGENT_BUS" / "PING_PONG_BALLS.json") or {}
    cells_dir = ROOT / "ops" / "commercial" / "cells"
    cells = []
    if cells_dir.exists():
        for f in sorted(cells_dir.glob("CELL-*.json")):
            cells.append(json.loads(f.read_text(encoding="utf-8")))
    reg = read_json(ROOT / "ops" / "silos" / "true_silos_registry.json") or {}

    out = {
        "balls_version": balls.get("version"),
        "verified_external_revenue_nzd": balls.get("current_truth", {}).get(
            "verified_external_revenue_nzd", 0
        ),
        "immediate_next": balls.get("immediate_next", []),
        "phase1_cells": [
            {
                "id": c.get("opportunity_id"),
                "status": c.get("status"),
                "buy_url": c.get("proposed_offer", {}).get("buy_url"),
                "next": "DISTRIBUTE" if c.get("status") == "authorized" else c.get("status"),
            }
            for c in cells
        ],
        "true_silos_count": reg.get("count", 0),
        "true_silos_target": reg.get("target_true_silos", 500),
        "household": balls.get("household"),
        "reminder": "Post a buy URL. Architecture does not deposit money.",
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
