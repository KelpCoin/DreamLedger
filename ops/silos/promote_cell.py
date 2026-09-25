#!/usr/bin/env python3
"""Promote a cell JSON to true-silo candidate (local registry). Does not touch Supabase live."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REG = ROOT / "ops" / "silos" / "true_silos_registry.json"


def load() -> dict:
    if REG.exists():
        return json.loads(REG.read_text(encoding="utf-8"))
    return {"version": 1, "true_silos": [], "updated": None}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--cta", required=True)
    ap.add_argument("--kind", choices=["money_silo", "care_silo", "true_silo"], default="true_silo")
    ap.add_argument("--price-nzd", type=float, default=None)
    args = ap.parse_args()

    data = load()
    entry = {
        "id": args.id,
        "title": args.title,
        "cta_url": args.cta,
        "kind": args.kind,
        "price_nzd": args.price_nzd,
        "is_true_silo": True,
        "public_safe": True,
        "promoted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    data["true_silos"] = [s for s in data["true_silos"] if s.get("id") != args.id]
    data["true_silos"].append(entry)
    data["updated"] = entry["promoted_at"]
    data["count"] = len(data["true_silos"])
    REG.parent.mkdir(parents=True, exist_ok=True)
    REG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "count": data["count"], "entry": entry}, indent=2))


if __name__ == "__main__":
    main()
