"""CLI for qualification, outreach drafting, fulfilment proof, and ledger verification.

No network access, messaging, model invocation, or Stripe mutation occurs here.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import draft as draft_mod
from . import fulfil as fulfil_mod
from . import ledger
from . import qualify as qualify_mod


def cmd_qualify(args: argparse.Namespace) -> int:
    text = Path(args.thread_text).read_text(encoding="utf-8")
    result = qualify_mod.evaluate(thread_text=text, thread_url=args.thread_url, buyer_handle=args.buyer, last_buyer_activity=args.last_buyer_activity, thread_kind=args.thread_kind)
    ledger.record("qualification.evaluated", {"buyer": args.buyer, "url": args.thread_url, "verdict": result["verdict"], "points_failed": result.get("points_failed", [])})
    print(json.dumps(result, indent=2))
    return 0 if result["verdict"] == "PASS" else 1


def cmd_draft(args: argparse.Namespace) -> int:
    result = draft_mod.draft(buyer_handle=args.buyer, problem_summary=args.problem, scope_kind=args.scope, price_nzd=args.price, extra_scope_line=args.scope_line)
    out = Path("dreamledger/drafts") / f"{args.buyer}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    ledger.record("outreach.drafted", {"buyer": args.buyer, "price_nzd": args.price, "scope": args.scope})
    print(result["body"])
    print(f"--- saved to {out}")
    print(f"--- price NZ${args.price} — approve before sending")
    return 0


def cmd_fulfil(args: argparse.Namespace) -> int:
    deliverable = Path(args.deliverable_file).read_text(encoding="utf-8")
    record = fulfil_mod.record_fulfilment(order_id=args.order, sku=args.sku, amount_cents=args.amount_cents, currency=args.currency, buyer_reference=args.buyer, deliverable_text=deliverable, delivery_channel=args.channel, time_taken_minutes=args.minutes, notes=args.notes)
    print(json.dumps(record, indent=2))
    return 0


def cmd_verify(_: argparse.Namespace) -> int:
    result = ledger.verify()
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


def main() -> int:
    p = argparse.ArgumentParser(prog="dreamledger.pipeline")
    sub = p.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("qualify")
    q.add_argument("--thread-text", required=True); q.add_argument("--thread-url", required=True); q.add_argument("--buyer", required=True); q.add_argument("--last-buyer-activity"); q.add_argument("--thread-kind", choices=["hiring", "for_hire", "unknown"], default="unknown"); q.set_defaults(fn=cmd_qualify)
    d = sub.add_parser("draft")
    d.add_argument("--buyer", required=True); d.add_argument("--problem", required=True); d.add_argument("--scope", choices=["rescue", "implementation"], required=True); d.add_argument("--price", type=int, required=True); d.add_argument("--scope-line", default=""); d.set_defaults(fn=cmd_draft)
    f = sub.add_parser("fulfil")
    f.add_argument("--order", required=True); f.add_argument("--sku", required=True); f.add_argument("--amount-cents", type=int, required=True); f.add_argument("--currency", required=True); f.add_argument("--buyer", required=True); f.add_argument("--deliverable-file", required=True); f.add_argument("--channel", required=True); f.add_argument("--minutes", type=int, required=True); f.add_argument("--notes", default=""); f.set_defaults(fn=cmd_fulfil)
    v = sub.add_parser("verify"); v.set_defaults(fn=cmd_verify)
    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
