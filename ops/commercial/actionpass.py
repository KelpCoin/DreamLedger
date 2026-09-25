#!/usr/bin/env python3
"""ActionPass-lite: propose → authorize → execute boundary (DB-backed, no crypto)."""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "ops" / "commercial" / "data" / "commercial.sqlite3"

# Hard safety: action types that may never auto-execute without human approved_by
MONEY_ACTIONS = {"stripe_refund", "create_ad_campaign", "spend_budget"}


def utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect() -> sqlite3.Connection:
    DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS commercial_actions (
          action_id TEXT PRIMARY KEY,
          mission_id TEXT,
          agent_id TEXT,
          action_type TEXT NOT NULL,
          parameters_json TEXT,
          parameters_hash TEXT,
          maximum_spend_cents INTEGER,
          currency TEXT,
          expires_at TEXT,
          approved_by TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          executed_at TEXT,
          result_json TEXT
        )
        """
    )
    c.commit()
    return c


def phash(params: dict) -> str:
    raw = json.dumps(params, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()[:32]


def propose(conn: sqlite3.Connection, action_type: str, params: dict, agent_id: str = "agent", mission_id: str | None = None, max_spend_cents: int | None = None) -> dict:
    aid = f"act_{uuid.uuid4().hex[:12]}"
    now = utc()
    conn.execute(
        "INSERT INTO commercial_actions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            aid,
            mission_id,
            agent_id,
            action_type,
            json.dumps(params),
            phash(params),
            max_spend_cents,
            "NZD",
            None,
            None,
            "proposed",
            now,
            None,
            None,
        ),
    )
    conn.commit()
    return {"action_id": aid, "status": "proposed", "action_type": action_type}


def authorize(conn: sqlite3.Connection, action_id: str, approved_by: str) -> dict:
    row = conn.execute("SELECT * FROM commercial_actions WHERE action_id=?", (action_id,)).fetchone()
    if not row:
        raise SystemExit("unknown action_id")
    if row["status"] not in ("proposed", "blocked"):
        raise SystemExit(f"cannot authorize from status={row['status']}")
    conn.execute(
        "UPDATE commercial_actions SET status=?, approved_by=? WHERE action_id=?",
        ("authorized", approved_by, action_id),
    )
    conn.commit()
    return {"action_id": action_id, "status": "authorized", "approved_by": approved_by}


def execute(conn: sqlite3.Connection, action_id: str, *, dry_run: bool = True) -> dict:
    row = conn.execute("SELECT * FROM commercial_actions WHERE action_id=?", (action_id,)).fetchone()
    if not row:
        raise SystemExit("unknown action_id")
    if row["status"] != "authorized":
        raise SystemExit("execute requires status=authorized")
    if row["action_type"] in MONEY_ACTIONS and not row["approved_by"]:
        raise SystemExit("money action requires approved_by")

    params = json.loads(row["parameters_json"] or "{}")
    result = {
        "dry_run": dry_run,
        "action_type": row["action_type"],
        "params": params,
        "note": "dry_run=true means no external side effect; set --execute for real handlers when wired",
    }

    # Safe side effects only: record intent for human distribution
    if row["action_type"] == "post_buy_url" and not dry_run:
        result["side_effect"] = "operator_must_post"
        result["buy_url"] = params.get("buy_url")

    if dry_run:
        status = "authorized"  # unchanged
        result["executed"] = False
    else:
        status = "executed"
        result["executed"] = True
        conn.execute(
            "UPDATE commercial_actions SET status=?, executed_at=?, result_json=? WHERE action_id=?",
            (status, utc(), json.dumps(result), action_id),
        )
        conn.commit()

    return {"action_id": action_id, "status": status, "result": result}


def main() -> None:
    ap = argparse.ArgumentParser(description="ActionPass-lite")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("propose")
    p.add_argument("--type", required=True)
    p.add_argument("--params", required=True, help="JSON object")
    p.add_argument("--agent", default="cli")
    p.add_argument("--mission", default=None)

    a = sub.add_parser("authorize")
    a.add_argument("action_id")
    a.add_argument("--by", required=True, help="human id")

    e = sub.add_parser("execute")
    e.add_argument("action_id")
    e.add_argument("--execute", action="store_true", help="leave dry_run")

    sub.add_parser("list")

    args = ap.parse_args()
    conn = connect()

    if args.cmd == "propose":
        params = json.loads(args.params)
        print(json.dumps(propose(conn, args.type, params, args.agent, args.mission), indent=2))
    elif args.cmd == "authorize":
        print(json.dumps(authorize(conn, args.action_id, args.by), indent=2))
    elif args.cmd == "execute":
        print(json.dumps(execute(conn, args.action_id, dry_run=not args.execute), indent=2))
    elif args.cmd == "list":
        rows = conn.execute("SELECT action_id, action_type, status, approved_by, created_at FROM commercial_actions ORDER BY created_at DESC LIMIT 20").fetchall()
        print(json.dumps([dict(r) for r in rows], indent=2))


if __name__ == "__main__":
    main()
