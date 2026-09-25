#!/usr/bin/env python3
"""Advance a loop instance stage. Blocks false revenue flags."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INST = ROOT / "AGENT_BUS" / "ECONOMIC-LOOPS" / "instances"
ORDER = [
    "DISCOVER",
    "OFFER",
    "DISTRIBUTE",
    "AUTHORIZE",
    "PAY",
    "SETTLE",
    "FULFIL",
    "PROOF",
    "LEARN",
    "REPEAT",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("instance_id")
    ap.add_argument("--to", required=True, help="Target stage name")
    ap.add_argument("--session", default=None, help="Stripe cs_ id after PAY")
    ap.add_argument("--external-buyer", action="store_true")
    ap.add_argument("--amount", type=float, default=None)
    args = ap.parse_args()

    path = INST / f"{args.instance_id}.json"
    if not path.exists():
        matches = list(INST.glob(f"*{args.instance_id}*.json"))
        if len(matches) == 1:
            path = matches[0]
        else:
            raise SystemExit("instance not found")

    inst = json.loads(path.read_text(encoding="utf-8"))
    to = args.to.upper()
    if to not in ORDER:
        raise SystemExit(f"invalid stage {to}")

    if to in ("PAY", "SETTLE", "FULFIL", "PROOF") and not args.external_buyer and not inst.get("buyer_external"):
        # allow recording stage but never auto revenue
        pass

    done = inst.setdefault("stages_done", [])
    if inst.get("stage") and inst["stage"] not in done:
        done.append(inst["stage"])
    inst["stage"] = to
    inst["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if args.session:
        inst["stripe_session_id"] = args.session
    if args.external_buyer:
        inst["buyer_external"] = True
    if args.amount is not None:
        inst["amount_nzd"] = args.amount

    if to == "SETTLE":
        inst["settled"] = True
    if to == "FULFIL":
        inst["fulfilled"] = True
    if to == "PROOF":
        inst["proof_sealed"] = True

    # Hard rule: verified revenue only if all true
    inst["counts_as_verified_revenue"] = bool(
        inst.get("buyer_external")
        and inst.get("settled")
        and inst.get("fulfilled")
        and inst.get("proof_sealed")
        and inst.get("stripe_session_id")
        and (inst.get("amount_nzd") or 0) > 0
    )

    path.write_text(json.dumps(inst, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "instance_id": inst["instance_id"],
                "stage": inst["stage"],
                "counts_as_verified_revenue": inst["counts_as_verified_revenue"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
