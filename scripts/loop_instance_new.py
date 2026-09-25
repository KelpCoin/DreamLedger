#!/usr/bin/env python3
"""Create a new economic loop instance from registry + template."""
from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REG = ROOT / "AGENT_BUS" / "ECONOMIC-LOOPS" / "registry.json"
INST = ROOT / "AGENT_BUS" / "ECONOMIC-LOOPS" / "instances"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("loop_id", help="e.g. LOOP-BILLBOARD-FOUNDING-50")
    ap.add_argument("--stage", default="DISTRIBUTE")
    args = ap.parse_args()

    reg = json.loads(REG.read_text(encoding="utf-8"))
    loop = next((x for x in reg["loops"] if x["loop_id"] == args.loop_id), None)
    if not loop:
        raise SystemExit(f"unknown loop_id: {args.loop_id}")

    INST.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    iid = f"inst-{stamp}-{args.loop_id.replace('LOOP-', '').lower()[:12]}-{uuid.uuid4().hex[:4]}"
    inst = {
        "schema": "dreamledger/loop-instance/v1",
        "instance_id": iid,
        "loop_id": args.loop_id,
        "name": loop.get("name"),
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stage": args.stage,
        "stages_done": [],
        "buy_url": loop.get("buy_url"),
        "price_nzd": loop.get("price_nzd"),
        "buyer_external": None,
        "stripe_session_id": None,
        "amount_nzd": None,
        "settled": False,
        "fulfilled": False,
        "proof_sealed": False,
        "counts_as_verified_revenue": False,
        "notes": "",
    }
    path = INST / f"{iid}.json"
    path.write_text(json.dumps(inst, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "path": str(path.relative_to(ROOT)), "instance_id": iid}, indent=2))


if __name__ == "__main__":
    main()
