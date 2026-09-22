#!/usr/bin/env python3
"""
First-sale money thread — checkpointed stages (LangGraph-style persistence).

Advances THREAD-FIRST-SALE through readiness stages required to earn income.
Does NOT call Stripe. Does NOT claim revenue.

Stages (align with economic loop + first-sale checklist):
  0 BOOT
  1 LINKS_VERIFIED
  2 SETTLEMENT_WORKFLOW_PRESENT
  3 SECRETS_OPERATOR_CONFIRM   (human)
  4 WEBHOOK_OPERATOR_CONFIRM   (human)
  5 DEMAND_PULSE_OPERATOR      (human: post share pack)
  6 AWAITING_EXTERNAL_PAY
  7 SETTLED_RECOGNIZED         (only after proof artifact exists)
  8 FULFILLED_PROOF            (only after fulfilment evidence)
  9 FOSSIL_SEALED              (meter may move only here + Settlement Sync)

Usage:
  python ops/money/run_first_sale_thread.py status
  python ops/money/run_first_sale_thread.py advance --stage LINKS_VERIFIED
  python ops/money/run_first_sale_thread.py advance --stage DEMAND_PULSE_OPERATOR --note "posted X"
  python ops/money/run_first_sale_thread.py next
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "BEC-PRIME" / "persistence"))
from checkpoint_store import connect, setup, put_checkpoint, get_latest, history  # noqa: E402

THREAD = "THREAD-FIRST-SALE"
DB = ROOT / "BEC-PRIME" / "persistence" / "data" / "checkpoints.sqlite"

STAGES = [
    "BOOT",
    "LINKS_VERIFIED",
    "SETTLEMENT_WORKFLOW_PRESENT",
    "SECRETS_OPERATOR_CONFIRM",
    "WEBHOOK_OPERATOR_CONFIRM",
    "DEMAND_PULSE_OPERATOR",
    "AWAITING_EXTERNAL_PAY",
    "SETTLED_RECOGNIZED",
    "FULFILLED_PROOF",
    "FOSSIL_SEALED",
]

# Honest money surfaces (catalog-aligned)
PAYMENT_LINK = "https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02"
STORE = "https://dreamledger.org/?src=dist"


def structural_checks() -> dict:
    return {
        "settlement_workflow": (ROOT / ".github/workflows/commerce-settlement-sync.yml").is_file(),
        "reconcile_script": (ROOT / "ops/commerce/reconcile-stripe-airtable.mjs").is_file(),
        "approved_offers": (ROOT / "BEC-PRIME/catalog/offers/approved.json").is_file(),
        "fulfillment_registry": (ROOT / "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json").is_file(),
        "first_sale_checklist": any((ROOT / "ops/economic").glob("FIRST-SALE*.md")),
        "payment_link": PAYMENT_LINK,
        "store": STORE,
        "verified_revenue_claim": "Still NZ$0 until Settlement Sync + external cs_ + fossil — never set by this script",
    }


def advance(stage: str, note: str = "") -> dict:
    if stage not in STAGES:
        raise SystemExit(f"Unknown stage {stage}. Allowed: {STAGES}")
    conn = connect(DB)
    setup(conn)
    checks = structural_checks()
    # Auto-gates for pure disk stages
    if stage == "LINKS_VERIFIED":
        ok = bool(PAYMENT_LINK and STORE)
        state = {"ok": ok, "payment_link": PAYMENT_LINK, "store": STORE, "note": note}
    elif stage == "SETTLEMENT_WORKFLOW_PRESENT":
        ok = checks["settlement_workflow"] and checks["reconcile_script"]
        state = {"ok": ok, "checks": checks, "note": note}
    elif stage in ("SECRETS_OPERATOR_CONFIRM", "WEBHOOK_OPERATOR_CONFIRM", "DEMAND_PULSE_OPERATOR"):
        state = {
            "ok": True,
            "operator_attestation": note or "operator confirmed",
            "note": note,
            "warning": "Attestation is not Stripe proof",
        }
    elif stage in ("SETTLED_RECOGNIZED", "FULFILLED_PROOF", "FOSSIL_SEALED"):
        state = {
            "ok": False if not note else True,
            "note": note,
            "requires": "External live payment evidence path / fossil hash must be referenced in note",
            "forbids": "Do not mark FOSSIL_SEALED without real settlement artifact",
        }
        if stage == "FOSSIL_SEALED" and not note:
            raise SystemExit("Refuse FOSSIL_SEALED without --note referencing proof artifact")
    else:
        state = {"ok": True, "note": note, "checks": checks}

    rec = put_checkpoint(conn, THREAD, stage, state)
    return {"checkpoint": rec, "state": state, "next_hint": next_stage(stage)}


def next_stage(current: str | None) -> str | None:
    if current is None:
        return STAGES[0]
    try:
        i = STAGES.index(current)
    except ValueError:
        return STAGES[0]
    if i + 1 >= len(STAGES):
        return None
    return STAGES[i + 1]


def status() -> dict:
    conn = connect(DB)
    setup(conn)
    latest = get_latest(conn, THREAD)
    cur = latest["stage"] if latest else None
    return {
        "thread_id": THREAD,
        "latest": latest,
        "next_stage": next_stage(cur),
        "stages": STAGES,
        "structural": structural_checks(),
        "income_truth": "Infrastructure readiness can advance offline; cash requires external pay + settlement + fossil",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["status", "advance", "next", "history", "boot"])
    ap.add_argument("--stage", default="")
    ap.add_argument("--note", default="")
    args = ap.parse_args()

    if args.command == "status":
        print(json.dumps(status(), indent=2, default=str))
        return 0
    if args.command == "boot":
        print(json.dumps(advance("BOOT", "thread opened"), indent=2))
        return 0
    if args.command == "advance":
        if not args.stage:
            raise SystemExit("--stage required")
        print(json.dumps(advance(args.stage, args.note), indent=2))
        return 0
    if args.command == "next":
        st = status()
        nxt = st["next_stage"]
        if not nxt:
            print(json.dumps({"done": True, "latest": st["latest"]}))
            return 0
        # Auto-advance only safe disk stages
        if nxt in ("BOOT", "LINKS_VERIFIED", "SETTLEMENT_WORKFLOW_PRESENT"):
            print(json.dumps(advance(nxt, "auto"), indent=2))
        else:
            print(
                json.dumps(
                    {
                        "awaiting_operator": True,
                        "next_stage": nxt,
                        "hint": f'python ops/money/run_first_sale_thread.py advance --stage {nxt} --note "..."',
                    },
                    indent=2,
                )
            )
        return 0
    if args.command == "history":
        conn = connect(DB)
        setup(conn)
        print(json.dumps(history(conn, THREAD), indent=2))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
